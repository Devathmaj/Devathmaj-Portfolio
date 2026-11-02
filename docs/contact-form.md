# Contact form

## Architecture and routes

The existing Eleventy/Nunjucks form and contact-only Rollup chunk are retained.
Taxi mounts one `ContactForm` per DOM form and destroys its listeners and widget
on leave. The existing explicit Turnstile loader is reused with action `contact`.
No Turnstile script is added to unrelated pages. The service worker already uses
network-only routing for `/api/*`.

`GET /api/contact` initializes a signed anonymous cookie. Existing valid cookies
are reused without extending their lifetime. `POST /api/contact` performs:

1. Actual URL hostname/origin restriction and required POST Origin.
2. Cloudflare `CF-Connecting-IP` identification (no forwarded-header fallback).
3. Atomic IP allowance consumption, including malformed or invalid-token POSTs.
4. JSON content type, bounded streaming body (8 KiB, 10-second read timeout),
   field type/length/email/honeypot validation and UUIDv4 idempotency validation.
5. Turnstile Siteverify: success, canonical hostname, and action `contact`.
6. Signed cookie verification and email configuration validation.
7. Atomic session allowance consumption immediately before Resend delivery.
8. Plain-text email using only server-configured sender/recipient and a fixed
   subject. The existing form's name, email, subject and message go in the body;
   its validated email is the Reply-To. There is no phone field in this form.

Responses are JSON, `Cache-Control: no-store`, with no permissive CORS.
Unsupported methods return 405 with Allow. Validation uses 400 (or 408/413/415
for body errors), forbidden hostname/origin/session uses 403, limits use 429
with Retry-After seconds, provider rejection uses 502, infrastructure failure
uses 503. Both upstream HTTP calls have 10-second timeouts. Limiter calls have
a 5-second timeout and fail closed. An email is never attempted without both
limiters. Existing build-identity middleware continues stamping API responses.

Production accepts only `https://devathmaj.me`; `*.pages.dev` and other hosts
are rejected even with a forged or missing Origin. Production configuration
must match the canonical constants. Only an explicit `CONTACT_LOCAL_DEV=true`
on a loopback request permits a local URL and a fixed local IP. It does not
relax production or preview-host checks.

## Limiter Worker, SQLite and privacy

`contact-rate-limiter/` is the separate Worker `portfolio-contact-limiter`.
Its public handler always returns 404, with workers.dev and preview URLs disabled.
Only a Durable Object binding accesses `ContactRateLimitShard.fetch()`.
Wrangler 4.156.0 supports the declarative SQLite `exports` configuration used here;
no migrations or legacy KV-backed counters are introduced.

`lib/contact-config.js` is the single source for operational limits. Changing
it requires redeploying both Worker and Pages:

| Scope | Allowance | Window |
| --- | --- | --- |
| POST IP | 60 requests | 600000 ms (10 minutes) |
| Verified browser session | 3 submissions | 3600000 ms (1 hour) |
| GET initialization IP | 60 requests | Separate 10-minute bucket |

Windows start at the first request. Denied attempts do not increment or slide
the window. There is no email-address limiter or global daily quota. Two sessions
sharing an IP have independent session limits, with only the higher network
ceiling shared. Clearing cookies creates a new anonymous identity: this is an
abuse barrier, not authentication. Turnstile, IP limits and the WAF rule
provide complementary protection against session churn.

Bucket identities are lowercase hex HMAC-SHA256 using
`CONTACT_RATE_LIMIT_SECRET`: `HMAC(secret, "ip:" + canonicalIP)`,
`HMAC(secret, "session:" + sessionID)` and a separate `init:` domain for GETs.
The first two digest characters select `shard:00` through `shard:ff` (256 possible
objects). Each shard stores many independent full `scope:digest` keys, not one
global counter or one object per visitor. Raw IPs, raw session IDs, tokens and
email content are never stored in the limiter.

SQLite table: `buckets(key TEXT PRIMARY KEY, count INTEGER, expires_at INTEGER)`.
The expiry index is `buckets_expiry(expires_at)`. Read/check/reset/increment runs
inside `storage.transactionSync()` with synchronous SQL and no asynchronous gap.
No caller can choose the quota or window: the Worker chooses policy by validated
scope. Alarms delete at most 500 expired rows per invocation using the expiry
index; remaining expired work is rescheduled, and empty shards stop scheduling.
There is no full-table cleanup on each request. Storage/alarm failures reject
the request rather than bypass limits.

**Every validated, verified delivery attempt consumes a session allowance,
including retries and temporary Resend failures.** This intentional policy can
require waiting before retrying an ambiguous delivery. Invalid input, failed
Turnstile and invalid sessions do not consume session allowances.

## Session cookie

`contact_session` contains a 256-bit Web Crypto random ID, issued-at timestamp,
expiry timestamp and HMAC-SHA256 signature from `CONTACT_SESSION_SECRET`.
Verification checks format, timestamps, expiry, maximum age and the signature
using Web Crypto verification. There is no session database.

Attributes: `HttpOnly; Secure; SameSite=Lax; Path=/api/contact; Max-Age=2592000`.
It is host-only (no Domain). The frontend awaits GET before permitting a POST;
if initialization fails, clicking Send retries preparation before any submission.
403 triggers initialization and asks the visitor to verify and submit again.

## Resend and retry behavior

The owner has confirmed `devathmaj.me` is verified in Resend. The production-only
`[env.production.vars]` sender is `Portfolio Contact <contact@devathmaj.me>`.
It takes effect on the next GitHub-triggered production deployment. The recipient
remains the private `CONTACT_TO_EMAIL` secret. No sender or recipient is inferred.
Missing or invalid sender configuration logs `contact_configuration_error` with
the variable name only, returns a generic 503, and never calls Resend. Local and
preview environments do not inherit the production sender.

The frontend generates `crypto.randomUUID()` for each logical submission and
retains it on retry with unchanged fields. A tab-local pending record contains
only its UUID, payload fingerprint and creation time. Separately, a tab-local
draft keeps the unsent name, email, subject and message in `sessionStorage`, so
a refresh (for example to recover the Turnstile widget) does not lose what the
visitor has written. The honeypot and Turnstile token are never stored. Input is
preserved after errors, cleared after acknowledged success, and editing the
fields or submitting after success creates a new logical submission.

Pages sends `Idempotency-Key: contact/<HMAC(secret, "submission:" + UUID)>` to
Resend. Cookie rotation does not change this key. Email payloads contain no
request-time timestamp or token, so retries are byte-identical. Resend handles
concurrent duplicate keys and rejects reuse with different parameters. The
application does not maintain a separate delivery ledger. Resend retains keys
for **24 hours**; the frontend refuses an unchanged ambiguous retry after 23
hours and asks the visitor to confirm receipt directly. This is not indefinite
exactly-once delivery. Rotating the rate-limit secret also changes provider keys;
avoid rotating it during unresolved deliveries, or confirm those manually.

A 200 means Resend **accepted** the request, not that inbox delivery is guaranteed.
Auth/rate-limit/provider/network/timeout failures never return success. Diagnostics
log a fixed category and upstream HTTP status only, not provider bodies, messages,
visitor addresses, cookie IDs, keys or tokens.

## Variables and secrets

| Name | Where / purpose |
| --- | --- |
| `TURNSTILE_SECRET_KEY` | Pages secret; existing widget's matching Siteverify secret |
| `CONTACT_SESSION_SECRET` | Pages secret; independent random 32+ byte signing secret |
| `CONTACT_RATE_LIMIT_SECRET` | Pages secret; independent random 32+ byte HMAC secret |
| `RESEND_API_KEY` | Pages secret; sending permission for configured domain |
| `CONTACT_FROM_EMAIL` | Production-only Wrangler variable; verified sender identity |
| `CONTACT_TO_EMAIL` | Pages secret/private variable; your receiving inbox |
| `CONTACT_ALLOWED_ORIGIN` | Wrangler variable: `https://devathmaj.me` |
| `CONTACT_ALLOWED_HOSTNAME` | Wrangler variable: `devathmaj.me` |
| `CONTACT_LOCAL_DEV` | `.dev.vars` only; explicit loopback-development switch |

The limiter Worker needs no secret or email credentials. `.dev.vars*` are ignored,
except the placeholder-only `.dev.vars.example`. `npm run contact:setup` appends
missing independent cryptographically random signing secrets and the local flag;
it neither prints keys nor changes existing values. Existing Turnstile credentials
are preserved. Empty existing values must be filled manually.

The verified Pages project is **`devathmaj`**, in **Devathmaj@gmail.com's Account**.
Its GitHub source is `Devathmaj/Devathmaj-Portfolio`, production branch `main`.
The repository Wrangler name was corrected to match the actual project. Remote
production has no existing KV bindings or unrelated service/storage bindings.
The existing preview build variable `NODE_VERSION=22` is retained in the preview
configuration. No remote preview settings or GitHub integration settings were changed.

The production build uses image v3, repository root, `npm run build`, and output
`_site`. Its existing Wrangler configuration hash confirms it already consumes
Wrangler configuration. `pages_build_output_dir = "_site"` and the external
`CONTACT_LIMITER` binding are ready for the next Git-triggered production deployment;
no separate dashboard binding action is needed. The canonical origin and hostname
are prepared as non-secret Wrangler variables and take effect on that deployment.

## Local development

Use Node 22 and the existing lockfile (`npm ci` on a new checkout).

```bash
npm run contact:setup
npm run build
# Terminal 1 (leave running):
npm run contact:limiter
# Terminal 2 (leave running):
npm run preview
```

Visit `http://localhost:8788/contact`. Loopback is a secure context in modern
browsers; if your browser declines the Secure cookie locally, use Wrangler's
`--local-protocol=https` and trust the development certificate. All cookie
security attributes remain enabled. Change ports if an existing preview occupies
8787/8788. Plain Eleventy `npm start` does not serve Functions.

The Pages command explicitly includes:

```text
--do CONTACT_LIMITER=ContactRateLimitShard@portfolio-contact-limiter
```

This uses Cloudflare's documented two-process external local binding mechanism:
https://developers.cloudflare.com/pages/functions/bindings/#interact-with-your-durable-object-namespaces-locally

Both processes are local; never add `--remote` or remote bindings for these tests.
If the registry is still discovering the Worker, an initial request may safely
return 503; wait for the connection and retry. Local counters persist under
Wrangler's ignored local state, entirely separate from production.

The installed Wrangler 4.156.0 bundles workerd supporting compatibility dates
through **2026-10-30**, one day behind the existing project setting. Only local
scripts and Miniflare tests override to October 30. Both production Wrangler
configurations retain October 31. No dependency upgrade was made.

For a manual real-provider local send, configure real Resend values in `.dev.vars`
and a matching Turnstile site/secret allowed on `localhost` (the current widget
site key can be used only if you permit localhost in that widget's settings).
Siteverify must return hostname `localhost` and action `contact`. Production still
requires `devathmaj.me`. Dummy Turnstile test responses with another hostname/action
are intentionally not accepted by this strict manual path. Automated tests mock
Siteverify and Resend and require neither provider credentials nor real tokens.

## Tests and validation

```bash
npm run test:contact
npm run contact:limiter:check
npx wrangler pages functions build functions --outdir .cache/contact-pages --compatibility-date=2026-10-31 --compatibility-flags=nodejs_compat
npm run build
npm run test:contact:local
```

The Node test runner uses existing jsdom for the real form markup and Wrangler's
bundled Miniflare/esbuild for real SQLite Durable Objects. No extra dependencies.
Test-only inspection/expiration/storage-failure endpoints exist only in the
in-memory test subclass and are never deployed. Tests cover independent counters,
concurrency, expiry/cleanup, session signatures, body/origin restrictions,
Siteverify failures, Resend idempotency/failures, frontend errors and lifecycle.
The two-process smoke test uses ports 8797/8798, launches both local processes,
checks cookies plus an invalid POST (no provider call), and stops its own processes.
Real Taxi navigation and visual Turnstile behavior still warrant a manual browser
check on deployment; DOM tests do not claim to emulate the entire browser.

## Production deployment

### Infrastructure preparation completed — 2026-11-02

- Wrangler 4.156.0 authenticated to the single account owning the canonical site.
- `portfolio-contact-limiter` did not exist before this preparation and was created.
- Deployed version: `3181be0e-f5bf-4772-8569-2ba187078a79` (100% deployment).
- Namespace: `794e9e15d50040d4a1478b22c9d26478`.
- Class: `ContactRateLimitShard`; Cloudflare metadata confirms `use_sqlite: true`.
- Public workers.dev and preview URLs remain disabled; the Worker has no public
  rate-limit or email-sending endpoint.
- All five approved production secrets were uploaded from existing local values
  and verified by names and encrypted types: `CONTACT_SESSION_SECRET`,
  `CONTACT_RATE_LIMIT_SECRET`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`,
  `CONTACT_TO_EMAIL`.
- Transfer used an allowlisted dotenv file in a Windows ACL-protected temporary
  directory. Duplicate definitions were rejected, original assignment formatting
  retained, and Wrangler disk logging disabled. The filtered file and directory
  were deleted immediately afterward. No secret values were displayed, no local
  secrets changed, and no other local settings were uploaded.
- At initial infrastructure preparation, `CONTACT_FROM_EMAIL` was absent. The
  owner has since confirmed domain verification, and the sender is now configured
  in repository `[env.production.vars]`, awaiting the next production deployment.
- No Pages deployment was triggered. The production deployment ID remained
  `8557bb53-97ba-4c29-80e1-31ab0bc861a5` before and after preparation.

### Remaining activation steps

Domain verification and repository production sender configuration are complete.

1. Review the prepared configuration, run the validation commands above, then
   commit and push to the connected **`main`** branch when you are ready to deploy.
   The Git integration runs `npm run build` and deploys `_site` and Functions,
   consuming the Wrangler binding and prepared secrets. Do not use
   `wrangler pages deploy` or the legacy `npm run deploy` Direct Upload helper.
   No GitHub Actions workflow or deployment-type change is needed.
2. The Free-plan WAF rule below is now deployed; retain it during activation.
3. Visit the canonical contact page, test initial and Taxi-return visits, submit
   one real message and verify arrival plus Reply-To. Confirm that the new Pages
   deployment contains the external binding before claiming rate limiting is active.

For future independent Worker updates, verify the current account first, then run:

```bash
npx wrangler whoami
npm run contact:limiter:check
npx wrangler deploy --config contact-rate-limiter/wrangler.toml
```

For an explicitly authorized future secret update, Wrangler's prompts keep values
out of command arguments. Existing secrets do not need re-uploading now:

```bash
npx wrangler pages secret put CONTACT_SESSION_SECRET --project-name devathmaj
npx wrangler pages secret put CONTACT_RATE_LIMIT_SECRET --project-name devathmaj
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name devathmaj
npx wrangler pages secret put RESEND_API_KEY --project-name devathmaj
npx wrangler pages secret put CONTACT_TO_EMAIL --project-name devathmaj
```

No DNS, DDoS, Resend verification or Queue changes were made. Production email
delivery has not been tested, and the new Durable Object application limits remain inactive
until Pages is deployed with the binding and required configuration.

## WAF burst rule — deployed and API-verified

Created through the zone-level Rulesets API on 2026-11-02, in `http_ratelimit`.
The entry point did not previously exist. A follow-up GET verified exactly one
enabled rule, including the exact custom JSON response. A second provisioning run
confirmed it was already correct and performed no update.

- Ruleset ID: `87d5f96794fd40d9bd77de4716f9230e`
- Rule ID: `8cff626df1634038a23bdddeb98f19a4`
- Active zone, Free plan and effective WAF Edit permission were API-verified.
  Token-policy introspection returned 403; the user confirmed zone-only scope.
- Credentials were loaded only in memory, never displayed or logged. `.dev.vars`
  was unchanged, the temporary script was removed, and no unrelated rules or zones
  were modified. No production flood or email test was performed.

| Setting | Value |
| --- | --- |
| Rule name | `Portfolio Contact API - Burst Protection` |
| Match | URI Path equals `/api/contact` |
| Expression | `(http.request.uri.path eq "/api/contact")` |
| Characteristics | `cf.colo.id`, `ip.src` |
| Threshold | 30 requests / 10 seconds |
| Action | Block |
| Mitigation duration | 10 seconds |
| Enabled | true |
| Custom response | HTTP 429, `application/json` |

Response body:

```json
{"error":"rate_limited","message":"Too many requests. Please wait a few seconds and try again."}
```

Do not filter by HTTP method: cover both GET initialization and POST submissions.
Durable Objects enforce the stricter application quotas. This WAF threshold is
not implemented inside the Pages Function. Monitor shared-network false positives
and adjust manually. WAF errors may be HTML; the frontend handles non-JSON failures.
Exact endpoint: `https://devathmaj.me/api/contact`.

Once triggered, Free-plan Block applies to matching traffic from the same IP
throughout the 10-second mitigation period; it is not excess-request throttling.
Counters include the Cloudflare data-centre characteristic. This additional burst
filter does not distinguish humans sharing a public IP or prevent every distributed
attack. Its deployment does not activate the pending Pages/Durable Object integration.

## Troubleshooting

- **403 on pages.dev:** expected; use the canonical production host or explicit
  local development. For session errors allow cookies, initialize GET again,
  and obtain a fresh Turnstile token.
- **400 verification:** confirm matching secret, hostname and action `contact`;
  expired/reused tokens require widget reset. No raw tokens are logged.
- **429:** respect Retry-After. Each session has three verified attempts/hour;
  the network flood bucket is distinct. Retrying a failed email consumes allowance.
- **503 during initialization:** check both signing secrets, Worker deployment,
  external binding/script name, storage health, trusted Cloudflare IP and canonical
  variables. Locally start the limiter process before Pages and let discovery finish.
- **502:** check Resend sending-key permissions, verified sender, provider status
  and dashboard diagnostics. Public errors deliberately omit provider details.
- **No inbox message despite 200:** inspect Resend delivery/bounce/spam status;
  200 means accepted, not delivered. Confirm recipient configuration.
- **No API under Eleventy:** build then use Wrangler Pages preview.
- **Local runtime date error:** use the provided local commands rather than
  changing the production compatibility date or upgrading tooling blindly.
- **Unexpected local 403/old behavior:** check that you opened the port printed by
  the current Wrangler process; another preview may already occupy 8788.
