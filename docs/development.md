# Development

Local setup and the scripts you'll actually type. For how the pieces fit
together, read [Architecture](architecture.md); for writing content, see
[Content](content.md).

## Requirements

- Node 20 or newer (developed on Node 22)
- npm
- Git (the build id uses the short commit hash when available)

## Setup

```bash
npm install
npm start        # http://localhost:8080
```

`npm install` runs `postinstall`, which does two things:

1. `scripts/patch-deps.js` applies two upstream fixes (see below).
2. `scripts/prepare-build.js --dev` creates a development build id.

A first install is enough to run the site. `npm start` launches Sass and Rollup
in watch mode alongside `npx @11ty/eleventy --serve`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` / `npm run dev` | Watch Sass + Rollup, serve Eleventy on `:8080` |
| `npm run start:quiet` | Same, with Eleventy's output silenced |
| `npm run build` | Clean CSS/JS, compile, bundle, render, then generate assets |
| `npm run clean` | Delete `_site/` |
| `npm run preview` | Serve `_site` with Wrangler on `:8788`, contact Function included |
| `npm run social:preview` | Regenerate the shared link-preview image derivatives |
| `npm run contact:setup` | Append missing local signing secrets to `.dev.vars` |
| `npm run contact:limiter` | Run the rate-limiter Worker locally on `:8787` |
| `npm run test:contact` | Contact unit tests (`node --test`) |
| `npm run test:contact:local` | Two-process Wrangler integration check |
| `npm run contact:limiter:check` | Dry-run deploy of the limiter Worker |
| `npm run deploy` | Legacy Direct Upload helper — **not used** (see [Deployment](deployment.md)) |

`npm run preview` binds the production Durable Object and passes
`--compatibility-date=2026-10-30`, so the contact route behaves like production.
The Function does not exist under `npm start`.

## Dependency patches

Two packages need a small source fix that upstream hasn't shipped. They're
applied by `scripts/patch-deps.js` on `postinstall`, replacing the Bun patches
the project originally used. Both are idempotent and detect already-patched
files.

**`@11ty/eleventy-plugin-webc@0.11.2`** — Eleventy 3 renders some component
contexts without `data.page.url`, but the plugin calls Eleventy's CSS/JS bundle
helpers unconditionally. The patch wraps that block in `if (data.page.url)`.

**`@unseenco/taxi@1.8.0`** — Taxi strips trailing slashes, turning `/` into an
empty pathname, so route transitions leaving the homepage never match. The patch
normalises an empty pathname back to `/` before matching in
`src/RouteStore.js` (the file Rollup actually bundles; the package's `main`
points at `src/taxi.js`).

Re-run `node scripts/patch-deps.js` after any reinstall if you see the old
behaviour. See [Troubleshooting](troubleshooting.md#install-and-patches).

## Build lifecycle

`npm run build` is four steps:

1. `prebuild` creates a production build id (`scripts/prepare-build.js`).
2. `build` removes `_site/js` and `_site/css`, compiles Sass, bundles Rollup,
   runs Eleventy.
3. `postbuild` writes `/assets/music.json` and `/assets/manifest.json` and
   builds `_site/sw.js` (`scripts/generate-assets.js`).
4. Done — `_site` is the deployable artifact.

Run Eleventy alone only if you don't need the manifest or service worker; the
asset step will fail without them. Full details in
[Architecture](architecture.md#build-lifecycle).

## Repo map

```
eleventy.config.js      plugins, passthroughs, filters, collections
rollup.config.js        three outputs: app bundle, rotation-init, service worker
wrangler.toml           Cloudflare Pages config
_11ty/                  filters, collections, Markdown library, shortcodes
lib/                    music manifest, dates, contact helpers + shared limits
functions/              Pages Functions (contact API, middleware, build stamp)
scripts/                patches, build id, asset generation, contact tooling
tests/contact/          node:test suites for the contact stack
src/
  _components/          WebC components
  _data/                site content and configuration
  _includes/            layouts and shared Nunjucks partials
  scss/                 styles
  js/                   client runtime (router, transitions, modules, worker)
  content/              Markdown: projects, now, speaking, additional-work
  *.njk                 page templates
  img/ music/ fonts/ certificate/ resume/ meta/
  _headers _redirects robots.txt
```

## Environment and secrets

Local credentials live in `.dev.vars` (git-ignored), documented by
`.dev.vars.example`. Run `npm run contact:setup` to generate the two local
signing secrets without touching existing values. Production secrets are managed
in the Cloudflare Pages dashboard; see [Deployment](deployment.md#wrangler-configuration).

## Where to go next

- [Architecture](architecture.md) — build internals, client runtime, asset
  library, service worker, rendering.
- [Content](content.md) — pages, projects, experience, certificates, music, art,
  hidden pages.
- [Deployment](deployment.md) — Pages, environments, secrets, cache behaviour.
- [Testing](testing.md) — unit tests, local integration, manual QA.
- [Troubleshooting](troubleshooting.md) — common failures.
- [Contact form](contact-form.md) — the full security and delivery story.
