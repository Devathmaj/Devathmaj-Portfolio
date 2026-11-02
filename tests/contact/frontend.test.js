import { beforeEach, afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import ContactForm from '../../src/js/ContactForm.js';

let dom, controller, form, calls, renders, resets, reply, template;
const nativeFormData = globalThis.FormData;
const submit = () => controller.onSubmit({ preventDefault() {} });
const fill = () => {
  for (const [name, value] of Object.entries({ name: 'Visitor', email: 'visitor@example.net', subject: 'Project', message: 'Test message', 'cf-turnstile-response': 'token' })) form.elements.namedItem(name).value = value;
};

beforeEach(async () => {
  // Exercise the real form markup instead of a copy of its selectors/fields.
  template = fs.readFileSync('src/contact.njk', 'utf8').match(/<form[\s\S]*?<\/form>/)[0];
  dom = new JSDOM(template, { url: 'https://devathmaj.me/contact' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.sessionStorage = dom.window.sessionStorage;
  globalThis.FormData = dom.window.FormData;
  window.matchMedia = () => ({ matches: false });
  renders = []; resets = 0; calls = [];
  window.turnstile = {
    render: (container, options) => {
      renders.push(options);
      container.innerHTML = '<input type="hidden" name="cf-turnstile-response">';
      return 'widget';
    }, reset: () => { resets++; }, remove: () => {},
  };
  reply = () => Response.json({ ok: true });
  mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, ...init });
    return init.method === 'GET' ? Response.json({ ok: true }) : reply();
  });
  form = document.querySelector('form');
  controller = new ContactForm(form);
  await controller.sessionPromise;
  fill();
});
afterEach(() => { controller?.destroy(); dom.window.close(); mock.restoreAll(); globalThis.FormData = nativeFormData; delete globalThis.window; delete globalThis.document; delete globalThis.sessionStorage; });

test('contact initializes a session and reuses the existing explicit widget with contact action', () => {
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/contact');
  assert.equal(calls[0].method, 'GET'); assert.equal(calls[0].credentials, 'same-origin');
  assert.equal(renders.length, 1); assert.equal(renders[0].action, 'contact');
  assert.equal(document.querySelectorAll('script[src*="turnstile"]').length, 0);
});

test('POST uses actual fields, cookie credentials, UUID and clears form on success', async () => {
  await submit();
  const request = calls.find((c) => c.method === 'POST');
  assert.equal(request.url, '/api/contact'); assert.equal(request.credentials, 'same-origin');
  assert.match(request.headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
  assert.equal(JSON.parse(request.body).turnstileToken, 'token');
  assert.ok(!Object.hasOwn(JSON.parse(request.body), 'phone'));
  assert.equal(form.elements.namedItem('message').value, '');
  assert.match(controller.status.textContent, /Thanks/); assert.ok(resets > 0);
});

test('double clicks cannot create concurrent POSTs', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  reply = async () => { await gate; return Response.json({ ok: true }); };
  const first = submit();
  assert.equal(controller.submitBtn.disabled, true);
  await submit();
  release(); await first;
  assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
});

test('network failure keeps input and retry UUID; editing creates another logical submission', async () => {
  reply = () => { throw new TypeError('offline'); };
  await submit(); await submit();
  assert.equal(form.elements.namedItem('message').value, 'Test message');
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts[0].headers['Idempotency-Key'], posts[1].headers['Idempotency-Key']);
  form.elements.namedItem('message').value = 'Changed message';
  await submit();
  assert.notEqual(calls.at(-1).headers['Idempotency-Key'], posts[0].headers['Idempotency-Key']);
  assert.ok(!sessionStorage.getItem('contact_pending_submission').includes('Changed message'));
});

test('400, 403, 429, 502 and 503 produce useful errors and preserve input', async () => {
  for (const status of [400, 403, 429, 502, 503]) {
    reply = () => Response.json({ error: status === 403 ? 'invalid_session' : 'send_failed' }, { status, headers: { 'Retry-After': '120' } });
    await submit();
    assert.equal(form.elements.namedItem('message').value, 'Test message');
    assert.equal(controller.submitBtn.disabled, false);
    assert.match(controller.status.textContent, status === 429 ? /2 minute/ : status === 403 ? /Session refreshed/ : status === 400 ? /check the form/ : /Unable to send/);
  }
  assert.equal(calls.filter((c) => c.method === 'GET').length, 2);
});

test('Taxi-style destroy and remount does not duplicate controller or submit listeners', async () => {
  assert.equal(new ContactForm(form), controller);
  assert.equal(calls.filter((c) => c.method === 'GET').length, 1);
  controller.destroy();
  controller = new ContactForm(form);
  await controller.sessionPromise; fill();
  assert.equal(new ContactForm(form), controller);
  await submit();
  assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
  assert.equal(renders.length, 2);
});

test('unrelated page import has no global Turnstile load; Taxi guards and cleanup stay wired', () => {
  const entry = fs.readFileSync('src/js/index.js', 'utf8');
  assert.match(entry, /if \(document.querySelector\('\.contact-form'\)\)/);
  assert.match(entry, /contactMountToken === token && form.isConnected/);
  assert.match(entry, /contactFormController\?\.destroy\(\)/);
  assert.ok(!entry.includes('challenges.cloudflare.com/turnstile'));
});

test('missing token prevents POST and expiry callback resets original widget', async () => {
  form.elements.namedItem('cf-turnstile-response').value = '';
  await submit();
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
  renders[0]['expired-callback'](); assert.ok(resets > 0);
});

test('unsent input survives a refresh and is cleared after acknowledged success', async () => {
  const values = { name: 'Ada Lovelace', email: 'ada@example.net', subject: 'Hello', message: 'A half-written message' };
  for (const [name, value] of Object.entries(values)) {
    form.elements.namedItem(name).value = value;
    form.elements.namedItem(name).dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  }
  await new Promise((resolve) => dom.window.setTimeout(resolve, 300));

  const draft = JSON.parse(sessionStorage.getItem('contact_form_draft'));
  assert.deepEqual(draft, values);
  assert.ok(!Object.hasOwn(draft, 'website'));
  assert.ok(!Object.hasOwn(draft, 'cf-turnstile-response'));

  // A refresh mounts a fresh form against the same tab storage.
  controller.destroy();
  document.body.innerHTML = template;
  form = document.querySelector('form');
  controller = new ContactForm(form);
  await controller.sessionPromise;
  for (const [name, value] of Object.entries(values)) {
    assert.equal(form.elements.namedItem(name).value, value);
  }

  fill();
  await submit();
  assert.equal(sessionStorage.getItem('contact_form_draft'), null);
});

test('pagehide flushes the latest draft before the tab is torn down', () => {
  form.elements.namedItem('message').value = 'Written just before refresh';
  window.dispatchEvent(new dom.window.Event('pagehide'));
  assert.match(sessionStorage.getItem('contact_form_draft'), /Written just before refresh/);
});

test('submission waits for session initialization before making POST', async () => {
  controller.destroy();
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, ...init });
    if (init.method === 'GET') await ready;
    return Response.json({ ok: true });
  });
  calls = [];
  controller = new ContactForm(form);
  const sending = submit();
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
  assert.equal(controller.submitBtn.disabled, true);
  // Let the existing widget mount before populating its hidden token.
  await Promise.resolve(); fill(); release(); await sending;
  assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
});
