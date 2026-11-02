import { CONTACT_CONFIG } from '../../lib/contact-config.js';

export class ContactError extends Error {
  constructor(code, status = 400, retryAfter) {
    super(code);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export const isEmail = (value) =>
  typeof value === 'string' && value.length <= 254 &&
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value);

// Stream with a hard cap: Content-Length is only an early rejection hint.
export async function readJson(request, maxBytes = CONTACT_CONFIG.CONTACT_MAX_BODY_BYTES) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ContactError('invalid_request', 415);
  }
  if (Number(request.headers.get('content-length')) > maxBytes) throw new ContactError('request_too_large', 413);
  if (!request.body) throw new ContactError('invalid_request');
  const reader = request.body.getReader();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel().catch(() => {});
      reject(new ContactError('invalid_request', 408));
    }, CONTACT_CONFIG.BODY_TIMEOUT_MS);
  });
  try {
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new ContactError('request_too_large', 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof ContactError) throw error;
    throw new ContactError('invalid_request');
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export function validateSubmission(payload, key) {
  const limits = { name: 100, email: 254, subject: 150, message: 5000, website: 200, turnstileToken: 2048 };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).some((name) => !Object.hasOwn(limits, name))) throw new ContactError('invalid_request');
  const fields = {};
  for (const [name, max] of Object.entries(limits)) {
    const value = Object.hasOwn(payload, name) ? payload[name] : (name === 'website' ? '' : undefined);
    if (typeof value !== 'string' || value.length > max ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new ContactError('invalid_request');
    fields[name] = value.trim();
  }
  if (!fields.name || !fields.subject || !fields.message || !isEmail(fields.email) || fields.website ||
      /[\r\n]/.test(fields.name + fields.subject)) throw new ContactError('invalid_request');
  if (!fields.turnstileToken) throw new ContactError('verification_failed');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key || '')) throw new ContactError('invalid_request');
  return fields;
}
