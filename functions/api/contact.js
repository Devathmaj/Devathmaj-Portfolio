import { sendContactEmail, verifyTurnstile } from '../../lib/contact.js';

const MAX_BODY_BYTES = 16 * 1024;
const LIMITS = {
  name: 100,
  email: 254,
  phone: 32,
  subject: 150,
  message: 5000,
  website: 200,
  turnstileToken: 4096,
};

const json = (body, status = 200) => Response.json(body, { status });

const field = (value, limit) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : '';

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const handlePost = async ({ request, env }) => {
  const contentType = (request.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (contentType !== 'application/json') {
    return json({ error: 'invalid_request' }, 415);
  }

  if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET_KEY) {
    console.error(
      'Contact form is missing RESEND_API_KEY or TURNSTILE_SECRET_KEY',
    );
    return json({ error: 'send_failed' }, 500);
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: 'invalid_request' }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'invalid_request' }, 400);
  }

  const name = field(payload.name, LIMITS.name);
  const email = field(payload.email, LIMITS.email);
  const phone = field(payload.phone, LIMITS.phone);
  const subject = field(payload.subject, LIMITS.subject);
  const message = field(payload.message, LIMITS.message);
  const website = field(payload.website, LIMITS.website);
  const turnstileToken = field(
    payload.turnstileToken,
    LIMITS.turnstileToken,
  );

  // Bots that fill the hidden field get the same response as a successful send.
  if (website) return json({ ok: true });

  if (!name || !isEmail(email) || !subject || !message) {
    return json({ error: 'invalid_request' }, 400);
  }

  if (!turnstileToken) {
    return json({ error: 'verification_failed' }, 403);
  }

  let verified;
  try {
    verified = await verifyTurnstile({
      secret: env.TURNSTILE_SECRET_KEY,
      token: turnstileToken,
      remoteIp: request.headers.get('CF-Connecting-IP'),
    });
  } catch (error) {
    console.error('Contact form: Turnstile verification failed', error);
    return json({ error: 'verification_unavailable' }, 502);
  }

  if (!verified) {
    return json({ error: 'verification_failed' }, 403);
  }

  try {
    await sendContactEmail(env, { name, email, phone, subject, message });
  } catch (error) {
    console.error('Contact form: Resend send failed', error);
    return json({ error: 'send_failed' }, 502);
  }

  return json({ ok: true });
};

export const onRequest = ({ request, env }) =>
  request.method === 'POST'
    ? handlePost({ request, env })
    : json({ error: 'method_not_allowed' }, 405);
