# Docs

Supporting notes for the site. Start wherever your question lives.

| Doc | What's inside |
| --- | --- |
| [Development](development.md) | Local setup, npm scripts, dependency patches, build lifecycle |
| [Architecture](architecture.md) | How Eleventy, the asset pipeline, the client runtime, and the service worker fit together |
| [Content](content.md) | Writing pages, projects, experience records, certificates, links, music, and the art shuffle |
| [Deployment](deployment.md) | Cloudflare Pages, Wrangler environments, secrets, the rate-limiter Worker, cache behaviour |
| [Testing](testing.md) | Contact-form tests, the local integration check, stylelint, and the manual QA pass |
| [Troubleshooting](troubleshooting.md) | The failures you'll actually hit, and what causes them |
| [Contact form](contact-form.md) | Deep dive on sessions, Turnstile, Resend, rate limiting, and production activation |
| [Social previews](social-previews.md) | The shared link-preview image, its derivatives, and every platform re-scrape |

## The 30-second orientation

- **Site:** Eleventy 3 → `_site/`, hosted on Cloudflare Pages at
  [devathmaj.me](https://devathmaj.me).
- **Build:** Sass and Rollup run before Eleventy; a post-build step writes the
  asset manifest, the music catalogue, and the service worker.
- **Client:** Taxi handles transitions between the home and project pages.
  Everything else is a normal load. Page-specific modules are dynamic imports.
- **Offline:** A service worker caches assets by content revision. HTML is always
  network-first so a new deploy is discovered immediately.
- **Contact:** `/api/contact` is a Pages Function. It needs a separately deployed
  Durable Object Worker for rate limiting — see [contact-form.md](contact-form.md).

## Handy commands

```bash
npm install          # deps + patches + dev build id
npm start            # dev server at http://localhost:8080
npm run build        # production build into _site/
npm run preview      # serve the build with Wrangler (contact form works here)
npm run social:preview # regenerate link-preview images from the master artwork
npm run test:contact # contact unit tests
```
