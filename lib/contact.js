import { CONTACT_CONFIG } from './contact-config.js';
import { ContactError, isEmail } from '../functions/_shared/contact-validation.js';

export async function verifyTurnstile({ secret, token, remoteIp, hostname }) {
  if (!secret) throw new ContactError('temporarily_unavailable', 503);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token, remoteip: remoteIp }),
      signal: AbortSignal.timeout(CONTACT_CONFIG.PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (typeof result.success !== 'boolean') throw new Error();
    return result.success === true && result.hostname === hostname && result.action === 'contact';
  } catch {
    throw new ContactError('verification_unavailable', 503);
  }
}

export function validateEmailConfig(env) {
  const from = env.CONTACT_FROM_EMAIL;
  const address = typeof from === 'string' ? (from.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] || from) : '';
  if (!isEmail(address) || /[\r\n]/.test(from)) {
    console.error('contact_configuration_error', {
      variable: 'CONTACT_FROM_EMAIL', reason: 'missing_or_invalid',
    });
    throw new ContactError('temporarily_unavailable', 503);
  }
  if (!env.RESEND_API_KEY || !isEmail(env.CONTACT_TO_EMAIL)) throw new ContactError('temporarily_unavailable', 503);
}

export async function sendContactEmail(env, submission, idempotencyKey) {
  const { name, email, subject, message } = submission;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      // Stable across retries: no generated timestamp or Turnstile token.
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL, to: [env.CONTACT_TO_EMAIL], reply_to: email,
        subject: 'Portfolio contact form message',
        text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
      }),
      signal: AbortSignal.timeout(CONTACT_CONFIG.PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error('contact_provider_rejected', { status: response.status });
      throw new Error();
    }
    const result = await response.json();
    if (typeof result.id !== 'string' || !result.id) throw new Error();
  } catch {
    throw new ContactError('send_failed', 502);
  }
}
