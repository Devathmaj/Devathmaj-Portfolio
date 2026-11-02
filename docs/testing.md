# Testing

There is no end-to-end browser suite. Coverage is concentrated on the contact
form, plus a manual pass for the visual and transition work.

## Contact unit tests

```bash
npm run test:contact
```

Runs `node --test tests/contact/*.test.js`:

- `api.test.js` — session issuance and reuse, origin/host checks, Turnstile
  verification, validation, Idempotency-Key behaviour, rate-limit calls, Resend
  failures, and error mapping. Resend and Turnstile are mocked.
- `frontend.test.js` — the DOM controller: session init, Turnstile reuse,
  duplicate-submit prevention, retry keys, error messaging, and Taxi
  destroy/remount cleanup.
- `limiter.test.js` — the Durable Object: IP and session quotas, fixed windows,
  alarms, SQLite failure handling, and rejection of malformed/internal requests.

These tests need no network access and no real credentials.

## Local integration test

```bash
npm run build
npm run test:contact:local
```

This starts two real Wrangler processes (the limiter Worker and a Pages preview),
waits for both, then checks:

- `GET /api/contact` issues an `HttpOnly; Secure` session cookie.
- A second GET with that cookie does not rotate it.
- An invalid POST is rejected with 400 (and consumes an IP allowance).
- `DELETE` returns 405.

It never calls Turnstile or Resend, and it kills both processes afterwards
(including a `taskkill /T` path on Windows). It expects a usable `.dev.vars` —
see [contact-form.md](contact-form.md#local-development). If the Durable Object
binding isn't up, the first GET returns 503 and the test retries briefly before
failing.

## Worker dry run

```bash
npm run contact:limiter:check
```

Bundles the limiter Worker into `.cache/contact-limiter` without deploying. Use
it to catch syntax or binding mistakes after editing `contact-rate-limiter/` or
`lib/contact-config.js`.

## Styles

`.stylelintrc.json` extends `stylelint-config-standard-scss` and enforces:

- BEM class naming (`block__element--modifier`),
- logical properties for most box/layout declarations,
- no vendor SCSS globals,
- quoted font family names.

There's no npm script wired up, so run it directly when touching Sass:

```bash
npx stylelint "src/scss/**/*.scss"
```

Prettier config is minimal (`.prettierignore` only excludes the bundled
Splitting.js vendor file). Formatting is not enforced in CI.

## Manual QA pass

Run `npm run preview` (not just `npm start`) so the service worker and Pages
Function behave like production.

**Navigation and transitions**

- Home → Projects, Projects → project, project → Projects, project → Home,
  Home → project. The first click from `/` is the regression covered by the Taxi
  patch; confirm it doesn't hard reload.
- Navigate to About, Contact, Certificates, `/now`, `/links` — these are normal
  page loads.
- Browser back/forward restores scroll position sensibly.

**Assets and offline**

- DevTools → Application: `sw.js` activates, `portfolio-assets-v1` fills with
  revision-keyed entries.
- Reload while offline: the home page shell and cached assets still render;
  navigations to uncached HTML fail by design.
- Deploy or bump the build id: one reload should converge on the new build
  without a loop.
- Stop the preview server and reload: no stale HTML should appear.

**Contact form**

- Load the page: session request succeeds, the Turnstile widget renders once.
- Submit valid content: success message, form clears.
- Submit twice quickly: only one request.
- Kill the network mid-submit: input is preserved and retry reuses the key.
- Expire the token: the widget resets cleanly.

**Progressive enhancement**

- Disable JavaScript: content, links, and audio `<noscript>` fallbacks work; the
  art shuffle shows a static image.
- `prefers-reduced-motion: reduce`: no scrubbed animations or auto-rotation.
- Keyboard: tab through nav, dialogs, the vinyl controls, and the certificate
  lightbox; `Escape` closes the discovery dialog.

**Hidden pages**

- Visit `/now` and `/links` directly; the discovery dialog updates 1/2 → 2/2 and
  the state survives a reload (`localStorage` key
  `portfolio:hidden-routes:v1`).

**Console and CSP**

- Production build: no CSP violations, no 404s for fonts/images, and the API
  responses carry `X-Site-Build`.
- `Shift+D` toggles the dark theme; `Shift+G` toggles the grid overlay.
