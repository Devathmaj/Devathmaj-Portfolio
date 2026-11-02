import { apiFetch } from './api/client.js';

const CONTACT_ENDPOINT = '/api/contact';
const TURNSTILE_SITE_KEY = '0x4AAAAAAFwSDW2gb3WgbrG7';

let turnstileLoader = null;
let themeListener = null;
const controllers = new WeakMap();
// The pending record keeps only a digest and UUID. The draft record keeps the
// unsent fields in this tab so a refresh (often needed to recover Turnstile)
// never throws away what the visitor has written.
const PENDING_KEY = 'contact_pending_submission';
const DRAFT_KEY = 'contact_form_draft';
const DRAFT_FIELDS = ['name', 'email', 'subject', 'message'];
const DRAFT_SAVE_DELAY = 200;

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
      script.addEventListener('error', () => {
        turnstileLoader = null;
        script.remove();
        reject(new Error('turnstile_failed'));
      });
      document.head.append(script);
    });
  }

  return turnstileLoader;
}

export default class ContactForm {
  constructor(form) {
    if (controllers.has(form)) return controllers.get(form);
    controllers.set(form, this);
    this.form = form;
    this.submitBtn = form.querySelector('.submit-btn');
    this.status = form.querySelector('#successMessage');
    this.turnstileContainer = form.querySelector('.cf-turnstile');
    this.widgetId = null;
    this.statusTimer = null;
    this.busy = false;
    this.destroyed = false;
    this.sessionReady = false;
    this.pending = null;
    this.draftTimer = null;

    this.onSubmit = this.onSubmit.bind(this);
    this.form.addEventListener('submit', this.onSubmit);

    this.onDraftChange = this.scheduleDraftSave.bind(this);
    this.form.addEventListener('input', this.onDraftChange);
    this.form.addEventListener('change', this.onDraftChange);

    this.onPageHide = this.saveDraft.bind(this);
    window.addEventListener('pagehide', this.onPageHide);

    this.restoreDraft();

    this.onThemeToggle = (event) => {
      if (!event.shiftKey || event.key !== 'D') return;
      window.setTimeout(() => this.remountTurnstile(), 0);
    };

    if (themeListener) window.removeEventListener('keypress', themeListener);
    themeListener = this.onThemeToggle;
    window.addEventListener('keypress', themeListener);

    this.mountTurnstile();
    this.initializeSession();
  }

  async initializeSession() {
    if (this.sessionPromise) return this.sessionPromise;
    this.submitBtn.disabled = true;
    this.sessionPromise = (async () => {
      try {
        const response = await apiFetch(CONTACT_ENDPOINT, {
          method: 'GET', credentials: 'same-origin', cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        });
        this.sessionReady = response.ok && (await response.json()).ok === true;
        if (!response.ok) this.showStatus(response.status === 429
          ? this.retryMessage(response)
          : 'Unable to prepare the form. Please try again in a moment.');
      } catch {
        this.sessionReady = false;
        this.showStatus('Unable to prepare the form. Check your connection and try again.');
      } finally {
        this.sessionPromise = null;
        if (!this.destroyed && !this.busy) this.submitBtn.disabled = false;
      }
      return this.sessionReady;
    })();
    return this.sessionPromise;
  }

  retryMessage(response) {
    const seconds = Number(response.headers.get('Retry-After'));
    return seconds > 0 && Number.isFinite(seconds)
      ? `Too many attempts. Please try again in ${Math.ceil(seconds / 60)} minute(s).`
      : 'Too many attempts. Please try again later.';
  }

  restoreDraft() {
    let draft = null;
    try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch { /* Optional tab persistence. */ }
    if (!draft || typeof draft !== 'object') return;

    for (const name of DRAFT_FIELDS) {
      const field = this.form.elements.namedItem(name);
      const value = draft[name];
      if (!field || typeof value !== 'string' || field.value) continue;
      field.value = field.maxLength > 0 ? value.slice(0, field.maxLength) : value;
    }
  }

  scheduleDraftSave() {
    window.clearTimeout(this.draftTimer);
    this.draftTimer = window.setTimeout(() => this.saveDraft(), DRAFT_SAVE_DELAY);
  }

  saveDraft() {
    window.clearTimeout(this.draftTimer);
    this.draftTimer = null;

    const draft = {};
    let hasContent = false;
    for (const name of DRAFT_FIELDS) {
      const field = this.form.elements.namedItem(name);
      if (!field) continue;
      draft[name] = field.value;
      if (field.value !== '') hasContent = true;
    }

    try {
      if (hasContent) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* Storage may be unavailable; the form still works. */ }
  }

  clearDraft() {
    window.clearTimeout(this.draftTimer);
    this.draftTimer = null;
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* Optional tab persistence. */ }
  }

  async submissionKey(fields) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fields)));
    const fingerprint = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('');
    let pending = this.pending;
    try { pending ||= JSON.parse(sessionStorage.getItem(PENDING_KEY)); } catch { /* Optional tab persistence. */ }
    if (pending?.fingerprint === fingerprint) {
      // Resend retains idempotency keys for 24h. Do not silently resend an old ambiguous attempt.
      if (Date.now() - pending.createdAt > 23 * 60 * 60 * 1000) throw new Error('retry_expired');
    } else {
      pending = { fingerprint, id: crypto.randomUUID(), createdAt: Date.now() };
    }
    this.pending = pending;
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* In-memory fallback. */ }
    return pending.id;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.saveDraft();
    this.form.removeEventListener('submit', this.onSubmit);
    this.form.removeEventListener('input', this.onDraftChange);
    this.form.removeEventListener('change', this.onDraftChange);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('keypress', this.onThemeToggle);
    if (themeListener === this.onThemeToggle) themeListener = null;
    window.clearTimeout(this.statusTimer);
    if (window.turnstile && this.widgetId !== null) window.turnstile.remove(this.widgetId);
    this.widgetId = null;
    controllers.delete(this.form);
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
      if (this.destroyed || !this.turnstileContainer.isConnected || this.widgetId !== null) {
        return;
      }

      const compact = window.matchMedia('(max-width: 379px)').matches;
      this.widgetId = turnstile.render(this.turnstileContainer, {
        sitekey: this.turnstileContainer.dataset.sitekey || TURNSTILE_SITE_KEY,
        action: 'contact',
        theme: document.body.classList.contains('dark') ? 'dark' : 'light',
        size: compact ? 'compact' : 'normal',
        'expired-callback': () => this.resetTurnstile(),
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
    if (!this.status || this.destroyed) return;

    window.clearTimeout(this.statusTimer);
    this.status.textContent = message;
    this.status.classList.add('show');
    this.statusTimer = window.setTimeout(() => {
      this.status.classList.remove('show');
    }, 5000);
  }

  async onSubmit(event) {
    event.preventDefault();
    if (this.busy || this.destroyed) return;
    this.busy = true;
    this.saveDraft();

    const submitBtn = this.submitBtn;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      if (!this.sessionReady && !await this.initializeSession()) return;
      if (this.destroyed) return;

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
      const subjectInput = String(formData.get('subject') || '').trim();
      const message = String(formData.get('message') || '').trim();
      const fields = { name, email: fromEmail, subject: subjectInput, message, website: String(formData.get('website') || '') };
      const submissionId = await this.submissionKey(fields);

      const response = await apiFetch(CONTACT_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submissionId },
        body: JSON.stringify({
          ...fields,
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
        error.retryMessage = this.retryMessage(response);
        throw error;
      }
      if (result?.ok !== true) throw new Error('send_failed');
      if (this.destroyed) return;

      this.pending = null;
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* Optional persistence. */ }
      this.clearDraft();
      this.form.reset();
      this.resetTurnstile();
      submitBtn.textContent = 'Send message';
      this.showStatus(
        'Thanks! Your message has been sent. I will get back to you within 24 hours.',
      );
    } catch (error) {
      if (this.destroyed) return;
      this.resetTurnstile();
      submitBtn.textContent = 'Send message';

      if (error.status === 429) {
        this.showStatus(error.retryMessage);
      } else if (error.status === 403) {
        this.sessionReady = false;
        if (await this.initializeSession()) this.showStatus('Session refreshed. Please verify and send again.');
      } else if (error.message === 'retry_expired') {
        this.showStatus('This earlier attempt is too old to retry safely. Please contact me directly to confirm receipt.');
      } else if (
        error.message === 'honeypot' ||
        error.message === 'turnstile_missing' ||
        error.message === 'verification_failed'
      ) {
        this.showStatus('Verification failed. Please refresh and try again.');
      } else if ([400, 413, 415].includes(error.status) || error.message === 'invalid_request') {
        this.showStatus('Please check the form and try again.');
      } else {
        this.showStatus(
          'Unable to send right now. Your message is still here; please try again in a moment.',
        );
      }
    } finally {
      this.busy = false;
      if (!this.destroyed) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send message';
      }
    }
  }
}
