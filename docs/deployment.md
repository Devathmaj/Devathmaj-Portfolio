# Deployment

The site ships on Cloudflare Pages. The contact form also depends on a separately
deployed Durable Object Worker, so "deployed" can mean two things.

## Normal flow

Production is GitHub-connected. Pushing to `main` builds and deploys the
Cloudflare Pages project **`devathmaj`**.

The Pages project should be configured to build with:

- Build command: `npm run build`
- Output directory: `_site`
- Node: 22. `NODE_VERSION=22` is currently set only on the *preview* environment,
  which no longer builds anything, so production falls back to Cloudflare's
  default. `package.json` declares `engines.node >= 22`, so pin `NODE_VERSION=22`
  for production as well rather than depending on the platform default.

The build output is self-contained: `_headers`, `_redirects`, `robots.txt`,
`sitemap.xml`, static passthroughs, the asset manifest, and `sw.js` all land in
`_site`.

### Preview deployments are off

Cloudflare's preview setting is `none` (`source.config.preview_deployment_setting`),
so pushes to any branch other than `main` — including Dependabot pull requests —
do **not** trigger a Pages build. Only `main` deploys.

This is deliberate. Dependabot opens up to five PRs at once, and each one used
to consume a full Pages build (six builds for six PRs, two of them failing).
Pull requests are now validated by GitHub Actions instead
(`.github/workflows/ci.yml` runs `npm run build` and `npm run test:contact`),
which is the cheaper and faster signal. Nothing is deployed to Cloudflare until
a change reaches `main`.

To restore previews, set it back to `all` in the dashboard under
**Settings → Builds & deployments → Preview deployments**, or use `custom` with
`preview_branch_includes` if only some branches need one.

> The old Direct Upload helper `npm run deploy` (`wrangler pages deploy _site`)
> is not part of this workflow. Don't use it; a direct upload bypasses the Git
> build and can leave the deployed build id out of sync with the repo.

## Wrangler configuration

`wrangler.toml` describes both Pages environments:

```toml
name = "devathmaj"
pages_build_output_dir = "_site"
compatibility_date = "2026-10-31"
compatibility_flags = ["nodejs_compat"]
```

`nodejs_compat` is required by the contact function (it uses `node:crypto`,
`Buffer`, and timing-safe helpers).

Both environments bind the rate limiter:

```toml
[[durable_objects.bindings]]
name = "CONTACT_LIMITER"
class_name = "ContactRateLimitShard"
script_name = "portfolio-contact-limiter"
```

Variables are repeated per environment because Pages variables/bindings are not
inherited when an environment is overridden:

| Variable | Production | Preview |
| --- | --- | --- |
| `CONTACT_ALLOWED_ORIGIN` | `https://devathmaj.me` | `https://devathmaj.me` |
| `CONTACT_ALLOWED_HOSTNAME` | `devathmaj.me` | `devathmaj.me` |
| `CONTACT_FROM_EMAIL` | verified Resend sender | — |
| `NODE_VERSION` | — | `22` |

Secrets are **not** in the repo. They live in the Pages dashboard under
Settings → Variables and Secrets:

- `TURNSTILE_SECRET_KEY`
- `CONTACT_SESSION_SECRET`
- `CONTACT_RATE_LIMIT_SECRET`
- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL`

`CONTACT_FROM_EMAIL` is a production variable (not a secret) because it is part
of the visible sender identity. There are no default addresses anywhere. See
[contact-form.md](contact-form.md) for the full activation checklist and the
manual WAF rule.

## The rate-limiter Worker

`contact-rate-limiter/` is a standalone Worker with a SQLite-backed Durable
Object. The Pages function reaches it through the `CONTACT_LIMITER` Durable
Object binding; the Worker is never exposed to the public internet
(`workers_dev = false`, `preview_urls = false`).

```bash
npm run contact:limiter:check   # wrangler deploy --dry-run for this Worker
npm run contact:limiter         # local dev on :8787 (used by tests)
npm run preview                 # Pages dev with the DO binding on :8788
```

The Worker must already exist in the account for the Pages binding to resolve.
When limits in `lib/contact-config.js` change, redeploy **both** the Worker and
Pages — the constants are shared by design.

## Local production preview

`npm run preview` runs:

```bash
wrangler pages dev _site --port=8788 --ip=127.0.0.1 \
  --compatibility-date=2026-10-30 \
  --do CONTACT_LIMITER=ContactRateLimitShard@portfolio-contact-limiter
```

`prepare-build.js --reuse` keeps the last build id, so a preview matches the
build you just made. The Pages Function only exists here (or on Cloudflare) —
under `npm start` the `/api/contact` route does not exist.

The full local contact setup, including the separate limiter terminal and
`.dev.vars`, is in [contact-form.md](contact-form.md#local-development).

## Cache and build ids

A deploy is more than new HTML. Each build has an id that is propagated to:

1. `<meta name="site-build">` in every HTML document,
2. `X-Site-Build` on every `/api/*` response,
3. `/assets/manifest.json`,
4. the injected `sw.js`.

On load, `AssetManager` requires those values to agree before it caches
anything. If the page is newer than the controlling worker, or the manifest
describes a different build, it performs a single guarded reload
(`asset:reload-build`) so the tab ends up on one consistent deployment. Updates
are activated with `SKIP_WAITING`, which reloads the page once.

HTML and API responses are intentionally network-only in the service worker, so
a normal navigation discovers a new deployment immediately. Static assets are
cached by `sha256` revision key and survive across deploys until obsolete entries
are reconciled.

`src/_headers` supports this:

```
/sw.js                       Cache-Control: no-cache
/assets/manifest.json        Cache-Control: no-store
/assets/music.json           Cache-Control: no-store
/api/*                       Cache-Control: no-store
```

Don't remove those rules; they're what prevent a new deploy from being masked by
a stale manifest or worker.

## Headers, redirects, and CSP

`src/_headers` sets a strict CSP. If a new third-party script is added, update
`script-src` (and `connect-src`/`frame-src` if needed) or it will be blocked in
production while working locally. Keep executable JavaScript external; inline
styles are allowed only because templates set CSS custom properties.

`src/_redirects` normalises trailing slashes (308) and sends `/experience` to the
first record. New flat pages should get matching rules if they should be
canonical without a trailing slash.

## Deploy checklist

- [ ] `npm run build` succeeds locally and `_site` contains `sw.js`,
      `assets/manifest.json`, `_headers`, `_redirects`.
- [ ] `_site/meta` contains the social preview derivatives and each page emits
      the image for its section; re-scrape the platforms in
      [`social-previews.md`](social-previews.md#platform-checklist) after deploy.
- [ ] `npm run preview` serves the home, projects, and contact pages.
- [ ] Contact `GET /api/contact` issues a session; a bad POST returns a useful
      status without calling Resend.
- [ ] `npm run test:contact` passes.
- [ ] Pushing to `main` produces a Pages deployment; the deployment log shows the
      expected build id and asset summary.
- [ ] After deploy, hard-refresh once, then check DevTools → Application for the
      new `sw.js` and a cache entry per revision.
- [ ] `https://devathmaj.me/sw.js` returns `Cache-Control: no-cache` and
      `https://devathmaj.me/assets/manifest.json` returns `no-store`.
- [ ] The contact form still submits with a real Turnstile token.

## Rolling back

Cloudflare Pages keeps previous deployments; roll back in the dashboard. Keep in
mind:

- Old HTML is network-only, so it will be served as soon as Pages points at the
  old build.
- Old tabs may hold asset revisions from the newer build; the asset manager
  reconciles against the manifest on their next load.
- The limiter Worker is versioned separately. Rolling back Pages does not roll
  back the Worker's limits or storage.
