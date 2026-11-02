import { apiFetch } from './api/client';

const CONTACT_ENDPOINT = '/api/contact';
const TURNSTILE_SITE_KEY = '0x4AAAAAAFwSDW2gb3WgbrG7';

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_KEY = 'contact_form_submissions';

let turnstileLoader = null;
let themeListener = null;

function getRateLimitData() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isRateLimited() {
  const now = Date.now();
  const timestamps = getRateLimitData().filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );

  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(timestamps));
  } catch {
    return false;
  }

  return timestamps.length >= RATE_LIMIT_MAX;
}

function recordSubmission() {
  const timestamps = getRateLimitData();
  timestamps.push(Date.now());

  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(timestamps));
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  if (!turnstileLoader) {
    turnstileLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', () => resolve(window.turnstile));
      script.addEventListener('error', () =>
        reject(new Error('turnstile_failed')),
      );
      document.head.append(script);
    });
  }

  return turnstileLoader;
}

export default class ContactForm {
  constructor(form) {
    this.form = form;
    this.submitBtn = form.querySelector('.submit-btn');
    this.status = form.querySelector('#successMessage');
    this.turnstileContainer = form.querySelector('.cf-turnstile');
    this.widgetId = null;
    this.statusTimer = null;

    this.onSubmit = this.onSubmit.bind(this);
    this.form.addEventListener('submit', this.onSubmit);

    this.onThemeToggle = (event) => {
      if (!event.shiftKey || event.key !== 'D') return;
      window.setTimeout(() => this.remountTurnstile(), 0);
    };

    if (themeListener) window.removeEventListener('keypress', themeListener);
    themeListener = this.onThemeToggle;
    window.addEventListener('keypress', themeListener);

    this.mountTurnstile();
  }

  remountTurnstile() {
    if (!this.turnstileContainer?.isConnected) {
      window.removeEventListener('keypress', this.onThemeToggle);
      if (themeListener === this.onThemeToggle) themeListener = null;
      return;
    }

    if (this.widgetId === null) return;

    window.turnstile.remove(this.widgetId);
    this.widgetId = null;
    this.mountTurnstile();
  }

  async mountTurnstile() {
    if (!this.turnstileContainer) return;

    try {
      const turnstile = await loadTurnstile();
      if (!this.turnstileContainer.isConnected || this.widgetId !== null) {
        return;
      }

      const compact = window.matchMedia('(max-width: 379px)').matches;
      this.widgetId = turnstile.render(this.turnstileContainer, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: document.body.classList.contains('dark') ? 'dark' : 'light',
        size: compact ? 'compact' : 'normal',
      });
    } catch (error) {
      console.error('Turnstile failed to load', error);
    }
  }

  resetTurnstile() {
    if (window.turnstile && this.widgetId !== null) {
      window.turnstile.reset(this.widgetId);
    }
  }

  showStatus(message) {
    if (!this.status) return;

    window.clearTimeout(this.statusTimer);
    this.status.textContent = message;
    this.status.classList.add('show');
    this.statusTimer = window.setTimeout(() => {
      this.status.classList.remove('show');
    }, 5000);
  }

  async onSubmit(event) {
    event.preventDefault();

    const submitBtn = this.submitBtn;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      if (isRateLimited()) {
        throw new Error('rate_limited');
      }

      const honeypot = this.form.querySelector('input[name="website"]');
      if (honeypot && honeypot.value) {
        throw new Error('honeypot');
      }

      const turnstileResponse = this.form.querySelector(
        '[name="cf-turnstile-response"]',
      );
      if (!turnstileResponse || !turnstileResponse.value) {
        throw new Error('turnstile_missing');
      }

      const formData = new FormData(this.form);
      const name = String(formData.get('name') || '').trim();
      const fromEmail = String(formData.get('email') || '').trim();
      const phone = String(formData.get('phone') || '').trim();
      const subjectInput = String(formData.get('subject') || '').trim();
      const message = String(formData.get('message') || '').trim();

      const response = await apiFetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Website visitor',
          email: fromEmail,
          phone,
          subject: subjectInput,
          message,
          website: String(formData.get('website') || ''),
          turnstileToken: turnstileResponse.value,
        }),
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        // Error responses are not guaranteed to be JSON.
      }

      if (!response.ok) {
        const error = new Error(result?.error || 'send_failed');
        error.status = response.status;
        throw error;
      }

      recordSubmission();
      this.form.reset();
      this.resetTurnstile();
      submitBtn.textContent = 'Send message';
      this.showStatus(
        'Thanks! Your message has been sent. I will get back to you within 24 hours.',
      );
    } catch (error) {
      console.error('Contact form send failed', error);
      this.resetTurnstile();
      submitBtn.textContent = 'Send message';

      if (error.message === 'rate_limited') {
        const timestamps = getRateLimitData().filter(
          (ts) => Date.now() - ts < RATE_LIMIT_WINDOW_MS,
        );
        const remaining = RATE_LIMIT_MAX - timestamps.length;
        this.showStatus(
          remaining > 0
            ? `Rate limit reached. You have ${remaining} message${remaining !== 1 ? 's' : ''} left today.`
            : 'Daily message limit reached (3/day). Please try again tomorrow.',
        );
      } else if (
        error.message === 'honeypot' ||
        error.message === 'turnstile_missing' ||
        error.message === 'verification_failed' ||
        error.message === 'verification_unavailable'
      ) {
        this.showStatus('Verification failed. Please refresh and try again.');
      } else if (error.message === 'invalid_request') {
        this.showStatus('Please check the form and try again.');
      } else {
        this.showStatus(
          'send_failed :: transmission error. Try again in a moment.',
        );
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send message';
    }
  }
}
