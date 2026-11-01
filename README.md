# devathmaj.me

Personal site and portfolio of Devathmaj A Kaliyathan. Eleventy 3 with Nunjucks,
WebC components, Sass and Rollup. Deployed to Cloudflare Pages, including the
serverless functions.

## Getting started

```bash
npm install      # installs dependencies and patches two upstream packages
npm start        # http://localhost:8080
npm run build    # one-off production build into _site/
npm run clean    # remove _site/
npm run preview  # wrangler pages dev _site --port=8788
npm run deploy   # build and publish _site to Cloudflare Pages
```

Requires Node 20 or newer (developed on Node 22).

`postinstall` runs `scripts/patch-deps.js`, which applies the two fixes the
project originally carried as Bun patches:

- `@11ty/eleventy-plugin-webc@0.11.2` — guards the CSS/JS bundle helpers when a
  render has no `data.page.url`. Eleventy 3 renders some component contexts
  without a page, which the plugin assumed always existed.
- `@unseenco/taxi@1.8.0` — normalizes an empty pathname back to `/` before route
  matching, so transitions leaving the homepage match. This patches
  `src/RouteStore.js`, which is the file Rollup bundles (the package's `main`
  points at `src/taxi.js`).

Both patches are idempotent and safe to re-run.

## How the build works

Three steps write into `_site/`:

1. **Sass** compiles `src/scss/{style,fonts,og}.scss` to `_site/css/*.css`.
2. **Rollup** bundles `src/js/index.js` and its dynamic imports to `_site/js/`.
3. **Eleventy** renders `src/**/*.{njk,md,webc}` and copies the passthroughs:
   `img/`, `fonts/`, `music/`, `meta/`, `certificate/`, `resume/`,
   `js/vendor/`, `.well-known/`, `robots.txt`, plus `_headers` and `_redirects`
   to the deploy root.

Sass and Rollup run before Eleventy in both `npm start` and `npm run build`.
Pages that embed images pass them through `@11ty/eleventy-img`, which emits
responsive WebP/JPEG derivatives next to the originals.

## Project structure

```
eleventy.config.js      Eleventy plugins, passthroughs, filters, collections
rollup.config.js        single bundle: src/js/index.js -> _site/js/
wrangler.toml           Cloudflare Pages settings (output: _site)
_11ty/                  collections, filters, Markdown libraries, shortcodes
lib/                    music, dates and contact helpers
functions/              Cloudflare Pages Functions: api/contact.js
scripts/                dependency patches
src/
  _components/          WebC components (home hero, marquee, page nav, …)
  _data/                site.json, about, certificates, experience, links, music
  _includes/
    layouts/base.njk    document shell: head, nav, router target, footer
    layouts/_project.njk project layout
    *.njk               footer, project entries, vinyl player, graphics
  scss/                 abstract/, base/, components/, pages/, vendor/
  js/                   entry point, routes, transitions, shaders, modules
  content/
    projects/           13 Markdown projects -> /projects/<slug>/
    now/ speaking/ additional-work/
  opengraph/            generated social cards (one per page and project)
  index.njk about.njk certificates.njk contact.njk projects.njk
  links.njk now.njk experience.njk experience-redirect.njk
  img/ fonts/ music/ meta/ certificate/ resume/
  _headers _redirects robots.txt
```

## Editing pages

Top-level pages are `.njk` files with front matter consumed by `base.njk` and
the shared includes:

| Key                  | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `title`              | Page title; `base.njk` appends `\| Devathmaj A Kaliyathan`        |
| `tags: ['page']`     | Marks an indexable page and feeds the Open Graph card collection |
| `permalink`          | Output path, e.g. `/projects/`                                   |
| `bodyClass`          | Extra `<body>` class (`home`, `project`, `dark`, `now-page`, …)  |
| `backLink`           | Target of the "←" link in the page nav                           |
| `backLinkText`       | Visible label for that link                                      |
| `footerLinks`        | Footer trail; extend in `eleventyComputed`                       |
| `noindex`            | Emits `<meta name="robots" content="noindex">`                   |
| `og`                 | Optional `og:image` URL                                          |
| `meta.title`         | Overrides `<title>` and `og:title`                               |
| `meta.description`   | Overrides the description and `og:description`                   |

The `page-nav-data` WebC component serializes `backLink`, `backLinkText` and
`footerLinks` for the client-side router; it is rendered from the same data, so
do not edit the JSON by hand.

Page bodies are plain HTML with Nunjucks. `src/_components/*.webc` holds the
component markup used by the home page and navigation.

Projects are Markdown in `src/content/projects/`. Their shared
`projects.11tydata.js` sets the `/projects/<slug>/` permalink, the project
layout, and the `project` collection tag. Experience records are paginated
from `src/_data/experience.js` by `experience.njk` into `/experience/<slug>/`;
`experience-redirect.njk` writes `/experience/index.html` as a redirect to the
first record.

## Notes

- `.dev.vars` is git-ignored and holds credentials for local serverless work.
  `.dev.vars.example` documents the expected keys. Rotate any key that has been
  shared.
- `src/_headers` sets a strict Content Security Policy: executable JavaScript is
  limited to the site itself and Cloudflare Turnstile. Inline styles remain
  allowed for template-level CSS custom properties. Keep new scripts external
  (or add an explicit hash/source) and test the contact page after changing it.
- The contact form posts to `/api/contact`, a Cloudflare Pages Function that
  verifies Turnstile and sends the message through Resend. It exists only under
  `wrangler pages dev` or a Cloudflare Pages deployment — not under `npm start`.
- The contact function needs `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY`.
  `CONTACT_FROM_EMAIL` and `CONTACT_TO_EMAIL` are optional and default to
  `Portfolio Devathmaj <onboarding@resend.dev>` and `devathmaj@gmail.com`.
  Before a sending domain is verified, Resend only allows
  `onboarding@resend.dev` as the sender and the Resend account owner's address
  as the recipient. Verify a domain and set `CONTACT_FROM_EMAIL` to an address
  on it for production.
- `_site-restored/` is the older deployed build, kept locally (git-ignored) for
  comparison with fresh builds.

## Deployment

Cloudflare Pages uses `wrangler.toml` (`pages_build_output_dir = "_site"`), so
`npm run build` must run before deploying. `_headers` and `_redirects` are
copied to the deploy root.

Cloudflare Pages auto-detects `functions/` and serves `api/contact.js` at
`/api/contact`. Runtime variables and secrets belong
in the Pages dashboard; `.dev.vars` is the local equivalent for
`wrangler pages dev`. The Node.js compatibility flag is enabled in
`wrangler.toml` for `node:crypto` and `Buffer`.
