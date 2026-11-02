import { isIP } from 'node:net';
import { CONTACT_CONFIG } from '../../lib/contact-config.js';
import { ContactError } from './contact-validation.js';

const encoder = new TextEncoder();
const hex = (bytes) => Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, '0')).join('');
const unhex = (value) => Uint8Array.from(value.match(/../g), (v) => parseInt(v, 16));
const COOKIE = 'contact_session';

async function signingKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new ContactError('temporarily_unavailable', 503);
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function hmac(secret, value) {
  return hex(await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(value)));
}

export function requestPolicy(request, env, post = false) {
  const url = new URL(request.url);
  // The explicit local opt-in cannot relax pages.dev or production validation.
  const local = env.CONTACT_LOCAL_DEV === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const hostname = local ? url.hostname : 'devathmaj.me';
  const origin = local ? url.origin : 'https://devathmaj.me';
  if (!local && (env.CONTACT_ALLOWED_HOSTNAME !== hostname || env.CONTACT_ALLOWED_ORIGIN !== origin)) throw new ContactError('temporarily_unavailable', 503);
  if (url.hostname !== hostname || (!local && url.origin !== origin) ||
      (post && request.headers.get('origin') !== origin) ||
      (!post && request.headers.has('origin') && request.headers.get('origin') !== origin)) throw new ContactError('forbidden', 403);
  return { local, hostname };
}

export function visitorIp(request, policy) {
  const ip = policy.local ? '127.0.0.1' : request.headers.get('CF-Connecting-IP');
  if (!ip || !isIP(ip)) throw new ContactError('temporarily_unavailable', 503);
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip;
}

export async function issueSession(env, now = Math.floor(Date.now() / 1000)) {
  const id = hex(crypto.getRandomValues(new Uint8Array(32)));
  const data = `${id}.${now}.${now + CONTACT_CONFIG.CONTACT_SESSION_MAX_AGE_SECONDS}`;
  const value = `${data}.${await hmac(env.CONTACT_SESSION_SECRET, data)}`;
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/api/contact; Max-Age=${CONTACT_CONFIG.CONTACT_SESSION_MAX_AGE_SECONDS}`;
}

export async function verifySession(request, env, now = Math.floor(Date.now() / 1000)) {
  const cookies = (request.headers.get('cookie') || '').split(';').map((v) => v.trim()).filter((v) => v.startsWith(`${COOKIE}=`));
  if (cookies.length !== 1) return null;
  const match = /^([a-f0-9]{64})\.(\d{1,12})\.(\d{1,12})\.([a-f0-9]{64})$/.exec(cookies[0].slice(COOKIE.length + 1));
  if (!match) return null;
  const [, id, issued, expires, signature] = match;
  const age = CONTACT_CONFIG.CONTACT_SESSION_MAX_AGE_SECONDS;
  if (+issued > now || +expires <= now || +expires <= +issued || +expires - +issued > age || now - +issued > age) return null;
  const valid = await crypto.subtle.verify('HMAC', await signingKey(env.CONTACT_SESSION_SECRET), unhex(signature), encoder.encode(`${id}.${issued}.${expires}`));
  return valid ? id : null;
}

export async function enforceLimit(env, scope, identifier) {
  try {
    const digest = await hmac(env.CONTACT_RATE_LIMIT_SECRET, `${scope}:${identifier}`);
    const stub = env.CONTACT_LIMITER.get(env.CONTACT_LIMITER.idFromName(`shard:${digest.slice(0, 2)}`));
    const response = await stub.fetch('https://limiter/consume', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: `${scope}:${digest}` }),
      signal: AbortSignal.timeout(CONTACT_CONFIG.LIMITER_TIMEOUT_MS),
    });
    const result = await response.json();
    if (response.status === 429 && result.allowed === false && Number.isSafeInteger(result.retryAfter) && result.retryAfter > 0) throw new ContactError('rate_limited', 429, result.retryAfter);
    if (response.status !== 200 || result.allowed !== true) throw new Error('limiter_unavailable');
  } catch (error) {
    if (error instanceof ContactError && error.status === 429) throw error;
    throw new ContactError('temporarily_unavailable', 503);
  }
}
