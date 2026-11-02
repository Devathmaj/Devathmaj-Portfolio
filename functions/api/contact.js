import { sendContactEmail, validateEmailConfig, verifyTurnstile } from '../../lib/contact.js';
import { ContactError, readJson, validateSubmission } from '../_shared/contact-validation.js';
import { enforceLimit, hmac, issueSession, requestPolicy, verifySession, visitorIp } from '../_shared/contact-security.js';

const json = (body, status = 200, headers = {}) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', ...headers },
});

const guarded = (handler) => async (context) => {
  try { return await handler(context); } catch (error) {
    if (error instanceof ContactError) return json({ error: error.message }, error.status, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
    console.error('contact_infrastructure_failure');
    return json({ error: 'temporarily_unavailable' }, 503);
  }
};

export const onRequestGet = guarded(async ({ request, env }) => {
  const policy = requestPolicy(request, env);
  await enforceLimit(env, 'init', visitorIp(request, policy));
  if (await verifySession(request, env)) return json({ ok: true });
  return json({ ok: true }, 200, { 'Set-Cookie': await issueSession(env) });
});

export const onRequestPost = guarded(async ({ request, env }) => {
  const policy = requestPolicy(request, env, true);
  const ip = visitorIp(request, policy);
  await enforceLimit(env, 'ip', ip);
  const key = request.headers.get('Idempotency-Key');
  const fields = validateSubmission(await readJson(request), key);
  if (!await verifyTurnstile({ secret: env.TURNSTILE_SECRET_KEY, token: fields.turnstileToken, remoteIp: ip, hostname: policy.hostname })) throw new ContactError('verification_failed');
  const session = await verifySession(request, env);
  if (!session) throw new ContactError('invalid_session', 403);
  validateEmailConfig(env);
  // Independent of cookie rotation; the browser UUID identifies the logical send.
  const providerKey = `contact/${await hmac(env.CONTACT_RATE_LIMIT_SECRET, `submission:${key.toLowerCase()}`)}`;
  await enforceLimit(env, 'session', session);
  await sendContactEmail(env, fields, providerKey);
  return json({ ok: true });
});

// Dispatch here prevents unsupported methods falling through to static HTML.
export const onRequest = (context) => {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
};
