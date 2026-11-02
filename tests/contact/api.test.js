import { beforeEach, afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/contact.js';
import { issueSession, verifySession, hmac, enforceLimit } from '../../functions/_shared/contact-security.js';
import { verifyTurnstile } from '../../lib/contact.js';
import { CONTACT_CONFIG } from '../../lib/contact-config.js';

let env, cookie, limits, sends, verified, provider, siteverify, deliveries;
const fields = { name: 'Test Visitor', email: 'visitor@example.net', subject: 'Project', message: 'A test message', website: '', turnstileToken: 'dummy-token' };
const makeRequest = (options = {}) => new Request(options.url || 'https://devathmaj.me/api/contact', {
  method: options.method || 'POST',
  headers: { Origin: 'https://devathmaj.me', 'CF-Connecting-IP': '192.0.2.10', 'Content-Type': 'application/json', Cookie: cookie,
    'Idempotency-Key': options.key || crypto.randomUUID(), ...options.headers },
  ...(options.method === 'GET' || options.method === 'DELETE' ? {} : { body: options.raw ?? JSON.stringify({ ...fields, ...options.fields }) }),
});
const call = (options) => onRequest({ request: makeRequest(options), env });

beforeEach(async () => {
  limits = []; sends = []; verified = 0; deliveries = new Map();
  env = {
    CONTACT_SESSION_SECRET: 'session-test-secret-'.repeat(4), CONTACT_RATE_LIMIT_SECRET: 'rate-test-secret-'.repeat(4),
    TURNSTILE_SECRET_KEY: 'dummy', RESEND_API_KEY: 'dummy', CONTACT_FROM_EMAIL: 'Portfolio <sender@example.net>', CONTACT_TO_EMAIL: 'recipient@example.net',
    CONTACT_ALLOWED_HOSTNAME: 'devathmaj.me', CONTACT_ALLOWED_ORIGIN: 'https://devathmaj.me',
    CONTACT_LIMITER: {
      idFromName: (name) => name,
      get: (shard) => ({ fetch: async (_, init) => {
        const body = JSON.parse(init.body); limits.push({ shard, ...body });
        return Response.json({ allowed: true });
      } }),
    },
  };
  cookie = (await issueSession(env)).split(';')[0];
  siteverify = () => Response.json({ success: true, hostname: 'devathmaj.me', action: 'contact' });
  provider = (_, init) => {
    const key = init.headers['Idempotency-Key'];
    if (deliveries.has(key)) assert.equal(deliveries.get(key), init.body, 'retry payload must be identical');
    deliveries.set(key, init.body);
    return Response.json({ id: 'mock-delivery' });
  };
  mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.includes('/siteverify')) { verified++; return siteverify(url, init); }
    assert.equal(url, 'https://api.resend.com/emails'); sends.push(init); return provider(url, init);
  });
});
afterEach(() => mock.restoreAll());

test('GET issues secure signed session and does not rotate a valid cookie', async () => {
  const response = await call({ method: 'GET', headers: { Cookie: '' } });
  assert.equal(response.status, 200);
  const value = response.headers.get('Set-Cookie');
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api/contact', 'Max-Age=2592000']) assert.ok(value.includes(attribute));
  assert.ok(!value.includes('Domain='));
  assert.ok(await verifySession(new Request('https://devathmaj.me', { headers: { Cookie: value.split(';')[0] } }), env));
  assert.equal((await call({ method: 'GET' })).headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('modified, malformed, expired, future, and overlong sessions are rejected', async () => {
  const check = (c, now) => verifySession(new Request('https://devathmaj.me', { headers: { Cookie: c } }), env, now);
  assert.ok(await check(cookie));
  assert.equal(await check(cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a')), null);
  assert.equal(await check('contact_session=invalid'), null);
  assert.equal(await check((await issueSession(env, 1)).split(';')[0]), null);
  assert.equal(await check((await issueSession(env, 100)).split(';')[0], 99), null);
  const data = `${'a'.repeat(64)}.1.${CONTACT_CONFIG.CONTACT_SESSION_MAX_AGE_SECONDS + 2}`;
  assert.equal(await check(`contact_session=${data}.${await hmac(env.CONTACT_SESSION_SECRET, data)}`, 2), null);
});

test('valid request reaches Resend with fixed server-controlled headers and HMAC buckets', async () => {
  env.CONTACT_FROM_EMAIL = 'Portfolio Contact <contact@devathmaj.me>';
  assert.equal((await call()).status, 200);
  assert.equal(sends.length, 1);
  const body = JSON.parse(sends[0].body);
  assert.equal(body.from, env.CONTACT_FROM_EMAIL);
  assert.equal(body.subject, 'Portfolio contact form message');
  assert.equal(body.reply_to, fields.email);
  assert.deepEqual(body.to, [env.CONTACT_TO_EMAIL]);
  assert.deepEqual(limits.map((l) => l.key.split(':')[0]), ['ip', 'session']);
  for (const l of limits) {
    const digest = l.key.split(':')[1];
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(l.shard, `shard:${digest.slice(0, 2)}`);
  }
});

test('same UUID and payload use identical Resend idempotency even after cookie rotation', async () => {
  const key = crypto.randomUUID();
  assert.equal((await call({ key })).status, 200);
  cookie = (await issueSession(env)).split(';')[0];
  assert.equal((await call({ key, fields: { turnstileToken: 'new-token' } })).status, 200);
  assert.equal(deliveries.size, 1);
  assert.equal((await call()).status, 200);
  assert.equal(deliveries.size, 2);
});

test('retry after a lost provider acknowledgement does not create another delivery', async () => {
  const accepted = provider;
  let first = true;
  provider = (url, init) => {
    const response = accepted(url, init);
    if (first) { first = false; throw new TypeError('connection lost after acceptance'); }
    return response;
  };
  const key = crypto.randomUUID();
  assert.equal((await call({ key })).status, 502);
  assert.equal((await call({ key, fields: { turnstileToken: 'fresh-token' } })).status, 200);
  assert.equal(deliveries.size, 1);
});

test('invalid fields, types, email, honeypot, JSON, token, and UUID stop before providers', async () => {
  for (const options of [
    { fields: { name: '' } }, { fields: { name: 123 } }, { fields: { message: [] } },
    { fields: { subject: 'x'.repeat(151) } }, { fields: { email: 'bad\r\n@example.net' } },
    { fields: { website: 'spam' } }, { fields: { website: null } }, { fields: { to: 'attacker@example.net' } },
    { fields: { turnstileToken: '' } }, { raw: '{' }, { raw: '[]' }, { key: 'bad' },
  ]) assert.equal((await call(options)).status, 400);
  assert.equal(sends.length, 0); assert.equal(verified, 0);
  assert.equal(limits.length, 12, 'invalid POSTs count toward IP ceiling');
});

test('actual streamed body cap works without Content-Length, including multibyte input', async () => {
  assert.equal((await call({ raw: 'x'.repeat(8193) })).status, 413);
  assert.equal((await call({ fields: { message: '界'.repeat(3000) } })).status, 413);
  assert.equal((await call({ headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal(sends.length, 0);
});

test('origin, pages.dev, missing trusted IP, and methods are enforced', async () => {
  for (const options of [
    { headers: { Origin: 'https://evil.example' } }, { headers: { Origin: '' } },
    { url: 'https://project.pages.dev/api/contact' }, { url: 'https://evil.example/api/contact' },
  ]) assert.equal((await call(options)).status, 403);
  assert.equal((await call({ headers: { 'CF-Connecting-IP': '', 'X-Forwarded-For': '192.0.2.10' } })).status, 503);
  assert.equal((await call({ method: 'DELETE' })).status, 405);
  env.CONTACT_LOCAL_DEV = 'true';
  assert.equal((await call({ url: 'https://project.pages.dev/api/contact' })).status, 403);
  assert.equal(sends.length, 0);
});

test('missing and tampered POST cookies never consume session allowance', async () => {
  for (const c of ['', 'contact_session=modified']) assert.equal((await call({ headers: { Cookie: c } })).status, 403);
  assert.equal(limits.filter((l) => l.key.startsWith('session:')).length, 0);
  assert.equal(sends.length, 0);
});

test('invalid/replayed token, wrong hostname, wrong action, and unexpected Siteverify fail closed', async () => {
  for (const result of [
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { success: true, hostname: 'evil.example', action: 'contact' },
    { success: true, hostname: 'devathmaj.me', action: 'login' },
  ]) {
    siteverify = () => Response.json(result);
    assert.equal((await call()).status, 400);
  }
  siteverify = () => Response.json({});
  assert.equal((await call()).status, 503);
  assert.equal(sends.length, 0);
});

test('Siteverify timeout is bounded and fails safely', async () => {
  mock.method(AbortSignal, 'timeout', () => AbortSignal.abort(new DOMException('Timed out', 'TimeoutError')));
  siteverify = (_, init) => { init.signal.throwIfAborted(); };
  await assert.rejects(verifyTurnstile({ secret: 'dummy', token: 'dummy', remoteIp: '192.0.2.10', hostname: 'devathmaj.me' }), { status: 503 });
  assert.equal(sends.length, 0);
});

test('IP or session rate limits block Resend with Retry-After', async () => {
  for (const scope of ['ip', 'session']) {
    env.CONTACT_LIMITER.get = () => ({ fetch: async (_, init) => JSON.parse(init.body).key.startsWith(`${scope}:`)
      ? Response.json({ allowed: false, retryAfter: 60 }, { status: 429 }) : Response.json({ allowed: true }) });
    const response = await call();
    assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60');
  }
  assert.equal(sends.length, 0);
});

test('missing binding, storage failure, malformed limiter response all fail closed', async () => {
  for (const result of [() => { throw new Error('storage failure'); }, () => Response.json({}, { status: 503 }), () => Response.json({ allowed: 'yes' })]) {
    env.CONTACT_LIMITER.get = () => ({ fetch: result });
    assert.equal((await call()).status, 503);
  }
  delete env.CONTACT_LIMITER;
  assert.equal((await call()).status, 503);
  assert.equal(sends.length, 0);
});

test('provider auth/rate-limit/server/network failures never report success and consume session attempt', async () => {
  for (const status of [401, 429, 500]) {
    provider = () => Response.json({ private: 'not exposed' }, { status });
    const response = await call();
    assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'send_failed' });
  }
  provider = () => { throw new DOMException('Timed out', 'TimeoutError'); };
  assert.equal((await call()).status, 502);
  assert.equal(limits.filter((l) => l.key.startsWith('session:')).length, 4);
});

test('email config has no fallback sender or recipient', async () => {
  const diagnostics = mock.method(console, 'error', () => {});
  const sender = env.CONTACT_FROM_EMAIL;
  for (const value of [undefined, '', 'invalid-sender']) {
    env.CONTACT_FROM_EMAIL = value;
    const response = await call();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'temporarily_unavailable' });
  }
  assert.equal(diagnostics.mock.callCount(), 3);
  for (const entry of diagnostics.mock.calls) {
    assert.deepEqual(entry.arguments, ['contact_configuration_error', {
      variable: 'CONTACT_FROM_EMAIL', reason: 'missing_or_invalid',
    }]);
  }
  assert.equal(limits.filter((l) => l.key.startsWith('session:')).length, 0);
  env.CONTACT_FROM_EMAIL = sender;
  delete env.CONTACT_TO_EMAIL;
  assert.equal((await call()).status, 503);
  assert.equal(sends.length, 0);
});

test('HMACs are stable, domain separated, and unique across identifiers', async () => {
  const values = [];
  env.CONTACT_LIMITER.get = (shard) => ({ fetch: async (_, init) => { values.push({ shard, ...JSON.parse(init.body) }); return Response.json({ allowed: true }); } });
  await enforceLimit(env, 'ip', '192.0.2.10'); await enforceLimit(env, 'ip', '192.0.2.10');
  await enforceLimit(env, 'ip', '198.51.100.20'); await enforceLimit(env, 'session', '192.0.2.10');
  assert.deepEqual(values[0], values[1]); assert.notEqual(values[0].key, values[2].key); assert.notEqual(values[0].key, values[3].key);
});
