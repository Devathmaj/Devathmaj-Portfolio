# Architecture

How the site is assembled, from Markdown to a cached page in someone's browser.

## The pieces

| Layer | Tool | Where |
| --- | --- | --- |
| Templates | Eleventy 3, Nunjucks, WebC | `src/**/*.njk`, `src/_components/*.webc` |
| Content | Markdown + front matter | `src/content/` |
| Styles | Sass (compressed, no source maps) | `src/scss/` |
| Behaviour | ES modules bundled by Rollup | `src/js/` |
| Hosting | Cloudflare Pages | `wrangler.toml`, `functions/` |
| Offline | Workbox service worker | `src/sw/service-worker.js` |

There is no framework runtime. The browser gets one ES-module entry
(`src/js/index.js`), a small synchronous `rotation-init.js`, and lazily imported
chunks for whichever page features are present.

## Build lifecycle

`npm run build` is a chain of npm lifecycle hooks:

1. **`prebuild`** → `scripts/prepare-build.js` creates a production build id.
2. **`build`** deletes `_site/js` and `_site/css`, compiles Sass, runs Rollup,
   then runs Eleventy.
3. **`postbuild`** → `scripts/generate-assets.js` writes `/assets/music.json`
   and `/assets/manifest.json`, then injects the precache manifest into the
   service-worker bundle and writes `_site/sw.js`.

`npm start` runs Sass and Rollup in watch mode alongside `eleventy --serve`.
`postinstall` applies the dependency patches and creates a development build id.

### Build ids

`scripts/build-info.js` creates an opaque id and stores it in
`.cache/build-meta.json` (git-ignored):

- Production: `YYYY-MM-DD-<commit>-HHMMSS-<entropy>`
- Development: `dev-YYYY-MM-DD-HHMMSS-<entropy>`

The id is written into three places:

- `src/_data/build.js` → `<meta name="site-build">` in `base.njk`.
- `functions/_shared/build.js` (generated, git-ignored) → API responses.
- `/assets/manifest.json` and `sw.js` after the build.

The browser treats the meta tag as the source of truth for the current
deployment. See [Deployment](deployment.md#cache-and-build-ids) for the update
flow.

`prepare-build.js` has three modes: default (production), `--dev`, and
`--reuse`, which reuses the last id for `npm run preview`.

## Eleventy configuration

`eleventy.config.js` wires up:

- **Render plugin** and **WebC** (`src/_components/**/*.webc`).
- **`@11ty/eleventy-img` transform** on HTML: WebP + JPEG, widths
  `auto/400/800/1400`, lazy loading and async decoding by default, file names
  like `name-800w.webp`.
- **Passthroughs**: `src/js/vendor` → `/js`, `src/meta`, `src/fonts`,
  `src/img/**` (images, SVG), `src/music`, `src/resume`, `src/certificate`,
  `src/robots.txt`, plus `_headers` and `_redirects` moved to the root.
- One collection, `hosted project`: all `project` items that have an output
  path. Ordinary pages use Eleventy's `page` tag.

### Filters

All filters live in `_11ty/filters.js`:

| Filter | Use |
| --- | --- |
| `sortedByPublishDate` | Newest first |
| `sortedByWorkOrder` | `workOrder`, then newest; missing orders go last |
| `humanReadableDate` / `toISOString` | Date formatting for templates |
| `readTime` | Word count at 200 wpm, ignoring code and MathJax |
| `canonicalUrl` | Strips `.html`, keeps section trailing slashes |
| `opengraphPermalink` | Maps a page URL to its OG card document |
| `getProjectNeighbors` | Previous/next project, wrapping around |
| `getProjectStack` | Reads the `Stack` paragraph into a list |
| `getTechIcon` | Maps a technology name to an SVG icon id |
| `projectTOC`, `projectContent` | Builds the TOC and strips hidden `stack` / `codebase` sections |
| `projectRecords`, `projectFigures` | Groups `h3` blocks and promotes image paragraphs to figure galleries |

Markdown is `markdown-it` with HTML enabled, typographer, attributes,
anchors (slugified with `@sindresorhus/slugify`), MathJax, and Prism. The
`asMarkdown` paired shortcode renders Markdown inside Nunjucks and adds a small
inline-footnote rule.

### Data files

| File | Drives |
| --- | --- |
| `site.json` | Nav/footer link groups |
| `layout.js` | Default layout (`layouts/base.njk`) |
| `build.js` | Build id meta tags |
| `about.js` | About page layers, facts, toolkit, credentials |
| `experience.js` | Paginated role records |
| `certificates.js` | Certificate archive |
| `links.js` | The hidden Links page |
| `music.js` | Vinyl catalogue, built from `lib/music.js` |
| `profile.js` | Shared identity/contact facts |
| `contact.js` | Contact page copy/fields |
| `footerLinks.json` | Default footer trail |

## Rendering

`layouts/base.njk` is the document shell. It emits the head (canonical, OG tags,
font preloads, build id), the persistent chrome (page nav, footer, discovery
notice, grid overlay), and a single `[data-taxi]` view wrapper around page
content. `page-nav-data.webc` serialises navigation data for the client router.

Pages opt into the shell with front matter (`layout` defaults to `base.njk`).
Project pages override it with `layouts/_project.njk`; experience records are
paginated by `experience.njk`; `experience-redirect.njk` sends `/experience/`
to the first record.

Output paths are intentionally flat. Standalone pages such as `about.njk`
produce `/about.html`, which Cloudflare serves as `/about`. Section indexes keep
a trailing slash. `src/_redirects` normalises the alternatives with 308s.

## Client runtime

`src/js/index.js` boots:

- **Taxi router** for the home ↔ projects journeys. Routes are registered for
  `/`, `/projects`, and `/projects/*`; any other link is a normal navigation.
  Transitions live in `src/js/transitions/` and `src/js/routes/`.
- **`DefaultRenderer`**, which runs on every Taxi enter/leave: destroys the
  previous page's modules, then imports only what the new DOM needs
  (`About`, `NotFound`, `ProjectShowcase`, `VinylPlayer`, `ContactForm`,
  `CertificateStack`, `ExperienceWaterfall`, `Marquee`, `Clock`, and so on).
- **Lazy mounts** for expensive work: the vinyl player mounts ~600px before it
  is visible, the footer shader ~300px, and both are cancelled if the page
  changes first.
- **Keyboard extras**: `Shift+D` toggles the dark theme, `Shift+G` toggles the
  grid overlay.
- **Discovery store**: remembers which hidden pages you've visited in
  `localStorage` (`portfolio:hidden-routes:v1`) and drives the progress dialog.

`rotation-init.js` is a classic synchronous script that applies the shuffled
art/quote choice before first paint; the module runtime takes over afterwards.

## Asset library and service worker

`scripts/generate-assets.js` walks `_site` and builds `/assets/manifest.json`:

- Every non-HTML asset gets a stable id, type, size, `sha256-…` revision, and a
  priority group (`music`, `homepage`, `other`).
- The homepage shell (preloaded fonts, CSS, all JS, the hero `<picture>`) is
  marked `critical`; the rest of the homepage imagery is deferred to a
  background pass.
- Critical entries become Workbox precache entries.

In the browser, `AssetManager` compares the page's build id with the manifest,
the service worker, and the API's build id. A mismatch triggers a single reload
with a guard key so the tab converges on one deployment.

The service worker (`src/sw/service-worker.js`):

- Precaches critical build assets and serves cached assets by revision key.
- Keeps HTML and `/api/*` **network-only**, so deploys are discovered by the
  next navigation.
- Caches `portfolio-assets-v1` and `portfolio-meta-v1`; old `portfolio-pages-*`
  caches are deleted on activation.
- Handles range requests for cached audio, and shares one in-flight transfer
  between speculative downloads and `<img>` requests.
- Activates updates only on request (`SKIP_WAITING`) so the page can reload once
  with matching HTML and assets.

Development builds (`dev-…`) deliberately skip the asset library entirely and
behave like an ordinary network-only site.

## Styling

Sass entry points are `style.scss`, `fonts.scss`, and `og.scss`. Partials are
organised into `abstract/` (tokens, mixins), `base/`, `components/`, `pages/`,
and `vendor/`. The codebase is BEM-ish and uses logical properties; `.stylelintrc.json`
enforces both (see [Testing](testing.md#styles)).

## Security and metadata

- `src/_headers` sets a strict CSP (`script-src 'self'` plus Turnstile), nosniff,
  referrer policy, and a restrictive permissions policy.
- No inline executable JavaScript. The `no-js` class is removed by the module
  entry instead of an inline script.
- `sitemap.njk` lists pages tagged `page` (excluding experience and `/now`) plus
  experience records and projects. `robots.txt` points at it.
- OG images are generated by rendering `/opengraph/*` pages and screenshotting
  them through `v1.screenshot.11ty.dev`; individual pages can override `og`.
