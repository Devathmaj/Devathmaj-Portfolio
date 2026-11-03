# Troubleshooting

Symptom first, cause second. Most of these have shown up at least once.

## Install and patches

**`npm install` warns that `patch-deps` couldn't find a target**
The package wasn't installed yet (or a version bump moved the file). Run
`npm install` again; if it persists, confirm the installed version of
`@unseenco/taxi` (1.8.0), then run `node scripts/patch-deps.js` manually and read
which check failed.

**Clicking a link from the homepage does a full page reload instead of a transition**
The Taxi route patch is missing. Re-run
`scripts/patch-deps.js`; the patched file is
`node_modules/@unseenco/taxi/src/RouteStore.js` and should contain
`currentUrlPathname`.

## Build

**`_site is missing. Run the Eleventy build before generating assets.`**
You ran `generate-assets.js` without a build. Use `npm run build`; it runs
Eleventy before the post-build asset step.

**`Service worker bundle is missing. Run rollup before generating assets.`**
Same story: the standalone asset step needs `.cache/sw-bundle.js`. Run the full
build (or at least `rollup --config` first).

**Eleventy fails importing `_shared/build.js`**
That file is generated and git-ignored. Run `node scripts/prepare-build.js`
(or any npm script with a `pre*` hook) to recreate it.

**Build ids show `local` instead of a commit**
The build isn't running inside a git checkout with a readable `HEAD`, or
`CF_PAGES_COMMIT_SHA` is unset on Cloudflare. Harmless, but it makes deploys
harder to identify in logs.

**A page builds but is missing from the sitemap**
Add `tags: ['page']` to its front matter. `/now` is excluded on purpose;
experience pages are added separately. `pages` tagged as `project` are also
added by their own loop.

**New page 404s on Cloudflare but exists locally**
Pages are emitted as flat `.html` files. Link to `/about`, not `/about/`, and add
a 308 to `src/_redirects` for the slash variant if needed.

## Local preview and contact

**`/api/contact` returns 503 or "limiter unavailable" under `npm run preview`**
The Durable Object binding needs a running Worker. Start the limiter in another
terminal:

```bash
npm run contact:limiter
```

and make sure the preview command still has
`--do CONTACT_LIMITER=ContactRateLimitShard@portfolio-contact-limiter`. Also
check that `portfolio-contact-limiter` exists in the Cloudflare account for
remote runs.

**`npm start` doesn't serve the contact form**
Expected. Pages Functions only run under `wrangler pages dev` / `npm run preview`
or on Cloudflare. Use preview for anything touching `/api/contact`.

**Contact returns 503 with `contact_configuration_error`**
A required sender/recipient/secret is missing. Check `.dev.vars` against
`.dev.vars.example`; in production check the Pages dashboard. The error log names
the variable but never prints its value.

**Turnstile fails only on localhost**
The widget is registered for `devathmaj.me`. Test responses with another
hostname/action are rejected by design. See
[contact-form.md](contact-form.md#local-development) for the dummy-token path or
use a hostname the widget allows.

**Sessions don't persist between runs**
`npm run contact:setup` appends missing `CONTACT_SESSION_SECRET` /
`CONTACT_RATE_LIMIT_SECRET` values without touching existing ones. If they
change, old cookies are invalidated.

## Service worker and caching

**A deploy doesn't appear until a hard refresh**
Check three things in DevTools:

1. `<meta name="site-build">` in the document.
2. `X-Site-Build` on any `/api/*` response.
3. `buildId` in `/assets/manifest.json`.

All three should match. If one is stale, the deploy is inconsistent — confirm
Cloudflare built the commit you think it did.

**Assets look like a mix of old and new**
The service worker caches by `sha256` revision key, so mixed content usually
means two documents from different builds are open. Close other tabs, hard
reload once, and check `Application → Cache Storage`. `portfolio-assets-v1` and
`portfolio-meta-v1` are expected; old `portfolio-pages-*` caches should be
deleted on activation.

**Development keeps caching old files**
Dev builds (`dev-…`) disable the asset library and service worker registration.
If you still see caching, unregister the worker in DevTools → Application and
clear site data once.

**A reload loop after deploying**
The asset manager reloads once per mismatch using the `asset:reload-build` guard.
A loop implies the three build-id sources disagree (usually a stale
`manifest.json` because `Cache-Control` headers weren't deployed). Verify
`_headers` shipped with the build.

## Tooling

**`npm audit` reports three low-severity findings after a clean install**
They are one advisory (CVE-2026-93753, `deepmerge` prototype poisoning),
counted once per node that carries it: `deepmerge`, `@rollup/plugin-node-resolve`
and `workbox-build`. Every `deepmerge` release up to and including the latest
(`4.3.1`, published 2023) is affected, so there is no patched version. npm's
offered fix is a downgrade that breaks the build. The only call site is
`deepMerge({}, defaults)` inside `@rollup/plugin-node-resolve`, merging a
hard-coded literal with no untrusted input, so the finding is accepted. CI gates
on `--audit-level=high` and deliberately does not fail on these.

**Sass compiles but stylelint complains about class names**
Selectors must match the BEM pattern in `.stylelintrc.json`. Logical properties
are required for most layout declarations; `width`, `height`, `top`, `left`, and
similar are exempted.

**Port 8080 or 8788 is already in use**
Stop the previous dev/preview process. On Windows, `Get-NetTCPConnection -LocalPort 8080`
followed by `Stop-Process -Id <pid>` finds the offender.

**Rollup fails on GLSL or dynamic imports**
Shaders are imported from `src/js/shaders/*.glsl` via `rollup-plugin-glsl`, and
route modules under `src/js/routes/` are resolved by
`@rollup/plugin-dynamic-import-vars`. New dynamic imports outside that pattern
need to be added to the plugin's `include` list.

**Images make the build very slow the first time**
Eleventy Image generates WebP/JPEG variants for every referenced image. The
first build after adding large originals is the expensive one; subsequent builds
reuse the cache. Very large source files (multi-megabyte art) also inflate the
deploy — pre-resize if quality allows.
