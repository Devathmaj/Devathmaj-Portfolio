const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TURNSTILE_ENDPOINT =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const DEFAULT_FROM_EMAIL =
  'Portfolio Devathmaj <onboarding@resend.dev>';
export const DEFAULT_TO_EMAIL = 'devathmaj@gmail.com';

const cleanHeader = (value) => value.replace(/[\r\n]+/g, ' ').trim();

export const verifyTurnstile = async ({ secret, token, remoteIp }) => {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  const res = await fetch(TURNSTILE_ENDPOINT, {
    method: 'POST',
    body,
  });

  if (!res.ok) {
    throw new Error(`Turnstile responded ${res.status}`);
  }

  const result = await res.json();
  return result.success === true;
};

export const sendContactEmail = async (env, submission) => {
  const { name, email, phone, subject, message } = submission;
  const from = cleanHeader(env.CONTACT_FROM_EMAIL || DEFAULT_FROM_EMAIL);
  const to = cleanHeader(env.CONTACT_TO_EMAIL || DEFAULT_TO_EMAIL);
  const sentAt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  const text = [
    'New message from the portfolio contact form.',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'N/A'}`,
    `Subject: ${subject}`,
    `Sent: ${sentAt} (Asia/Kolkata)`,
    '',
    message,
  ].join('\n');

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: cleanHeader(`[Portfolio] ${subject}`),
      text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend responded ${res.status}: ${detail.slice(0, 500)}`);
  }

  return res.json();
};
