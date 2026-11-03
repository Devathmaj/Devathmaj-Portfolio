# Content

Where every piece of text, image, and record lives, and what the templates expect
from it.

## Pages at a glance

| URL | Template | Notes |
| --- | --- | --- |
| `/` | `src/index.njk` | Home: hero, marquee, about, experience, projects, vinyl player |
| `/about` | `src/about.njk` | Driven by `_data/about.js` |
| `/projects/` | `src/projects.njk` | Index of project entries |
| `/projects/<slug>` | `src/content/projects/*.md` | One Markdown file per project |
| `/experience/<slug>` | `src/experience.njk` | Paginated from `_data/experience.js` |
| `/experience` | redirect | `experience-redirect.njk` sends it to the first record |
| `/certificates` | `src/certificates.njk` | Driven by `_data/certificates.js` |
| `/contact` | `src/contact.njk` | Copy from `_data/contact.js`; real POST to `/api/contact` |
| `/now` | `src/now.njk` | **Hidden page**; content from `src/content/now/` |
| `/links` | `src/links.njk` | **Hidden page**; entries from `_data/links.js` |
| `/404.html` | `src/404.njk` | Custom not-found page |

Hidden pages are reachable by direct URL but absent from the nav. Visits are
recorded in `localStorage` and surface in the discovery dialog. `/now` is also
excluded from the sitemap.

## Page front matter

Shared defaults come from `_data/layout.js` (the base layout). Any `.njk` page
can set:

| Key | Purpose |
| --- | --- |
| `title` | Page title; the base layout appends `\| Devathmaj A Kaliyathan` |
| `tags: ['page']` | Indexable page; feeds the sitemap |
| `permalink` | Output path (`/about.html` → `/about`) |
| `bodyClass` | Extra body class (`home`, `project`, `dark`, `now-page`, …) |
| `backLink` / `backLinkText` | The "←" link in the page nav |
| `footerLinks` | Footer trail; extend in `eleventyComputed` |
| `noindex` | Emits `<meta name="robots" content="noindex">` |
| `meta.title` / `meta.description` | Override `<title>` and social copy |

`page-nav-data.njk` serialises `backLink`, `backLinkText`, and `footerLinks` for
the router. It renders from the same values — don't hand-edit the JSON.

## Projects

Create `src/content/projects/<name>.md`. The shared `projects.11tydata.js`
derives `/projects/<slugified-title>` from the title, applies
`layouts/_project.njk`, and tags the page `project`.

### Front matter

```yaml
---
title: My Project
abstract: One or two sentences used on cards, meta tags, and the project index.
categories: [backend, full-stack]
publishDate: 2026-03-01T12:00-00:00
workOrder: 4                 # ordering in the projects list
projectStyle: dashboard      # dashboard | system | mobile | tool
isFeatured: false
prominence: primary          # primary | secondary | tertiary (featured only)
titleSplitIndex: 6           # optional: split point for the display title
heroLayout: stack            # stack | portrait
coverAspect: '16 / 9'
coverFit: cover              # cover | contain
coverPosition: 'top center'
theme:
  fill: '#1e3a8a'            # or url('…') for an image fill
  accent: '#1e3a8a'
  contrast: '#fff'
cover: /img/projects/my-project/cover.png
coverAlt: The dashboard
repo: https://github.com/Devathmaj/my-project
highlights:                  # optional stat strip
  - value: 3 roles
    label: Permission model
---
```

`projectStyle`, `heroLayout`, `coverAspect`, and `coverFit` fall back to
defaults in `projects.11tydata.js`.

### Body conventions

The project layout transforms Markdown in a few deliberate ways:

- The **cover image** (`cover` in front matter) is removed from the body; it is
  rendered as the hero instead.
- A paragraph containing exactly one image becomes a `<figure>` with the image's
  alt text as its caption, linked to the largest available file.
- Two or more consecutive figures are wrapped into a `.project-gallery`.
- Top-level `h3` blocks are grouped into `.project-record` blocks with their
  following paragraphs/lists.
- Headings named **Stack** and **Codebase** (`h2`) are pulled out of the rendered
  body and TOC. The `Stack` paragraph is comma-separated and becomes the stack
  chips at the top of the page.
- All `h2`s get slugified ids and feed the sidebar TOC.

Start with `## Overview`, then write whatever sections the project deserves.
Images referenced with standard Markdown go through Eleventy Image, so add good
alt text and keep originals in `src/img/projects/<slug>/`.

### Social previews

Preview images are shared by section, defined in `src/_data/site.json`
(`ogImage`) and emitted by `src/_includes/layouts/base.njk` as `og:image` and
`twitter:image` with type, dimensions and alt text:

| Section | `ogImageKey` | Master |
| --- | --- | --- |
| Default | *(omitted)* | `src/meta/devathmaj-portfolio-preview.png` |
| Projects | `projects` | `src/meta/devathmaj-project-preview.png` |
| About | `about` | `src/meta/devathmaj-about-preview.png` |
| Contact | `contact` | `src/meta/devathmaj-contact-preview.png` |

`/projects/` and every project page use the projects image; `/about` and
`/contact` use their own; everything else uses the default. Derivatives are
generated by `npm run social:preview`; see
[`docs/social-previews.md`](social-previews.md) for the sizes and the platform
re-scrape checklist.

## Experience records

`src/_data/experience.js` exports an array; `experience.njk` paginates it. Each
record uses:

| Key | Used for |
| --- | --- |
| `name`, `company`, `system` | Titles and mastheads |
| `slug` | URL: `/experience/<slug>` |
| `role`, `period`, `location` | Meta row |
| `titleSplitIndex`, `titleDivider`, `titleDividerLength` | Display title styling |
| `visual.kind`, `visual.caption`, `visual.stages`, `visual.roleCount` | System diagram |
| `summary`, `scope`, `constraints`, `decisions` | Narrative sections |
| `outcomes[]` | `{ value, label }` stat cards |
| `build.lead`, `build.items[]` | What was built, `{ title, text }` |
| `notes{}` | Small labels (role, scope, stack, …) |
| `stack[]` | Technology list |

Records are ordered as they appear in the array. Adding a new first record means
updating the `/experience/` redirect target in `src/experience-redirect.njk` if
the canonical "first" role changes.

Keep claims aligned with `src/resume/Devathmaj_Resume.pdf` — see `PRODUCT.md`.

## About page

`src/_data/about.js` holds the page's layers, facts, toolkit groups, projects,
and credentials. The template renders whatever is in those arrays, so adding an
entry usually means copying an existing object and updating its fields. Project
links point at real `/projects/<slug>` routes; experience links point at
`/experience/<slug>`.

## Certificates

`src/_data/certificates.js` entries include:

```js
{
  id, number, title, system, category, issuer,
  dateLabel, date, datetime, expiry,
  credentialLabel, credential, verify,
  pdf, image, imageWidth, imageHeight,
}
```

Place the PDF in `src/certificate/` and the preview image in
`src/img/certificates/`. Both are served from the paths you write in the data
file. The page's archive, lightbox, and PDF links read from these fields.

## Links page

`src/_data/links.js` is a flat array of `{ text, url }`. It powers the hidden
`/links` page, which has its own layout switch and sigil animation. External
links are rendered as-is; nothing is validated at build time.

## Music and the vinyl player

Drop audio files into `src/music/` (`.mp3`, `.ogg`, `.wav`). Then describe each
file in `lib/music.js`:

```js
'My Track.mp3': {
  id: 'record-xxxxxxxxxx',
  title: 'My Track',
  artist: 'Artist',
  album: 'The Listening Room',
  genre: 'Ambient',
  colour: '#bda17c',
},
```

The media element and playback UI are rendered from the Eleventy data file at
build time. `postbuild` also writes the catalogue to `/assets/music.json`, which
the browser's asset scheduler uses to prefetch tracks in the "music" priority
group. Files without metadata are skipped; track ordering is alphabetical by
filename, and `id` must be unique.

## Art shuffle

The home page's artwork is defined in `src/_includes/components/home-letter.njk`. Each
`<img data-shuffle-image>` is part of the shuffle:

```html
<img data-shuffle-image class="home-letter__img"
     src="/img/art/starry-night.jpg"
     alt="The Starry Night by Vincent van Gogh" ... />
```

`data-shuffle-interval="3600000"` sets the rotation interval (one hour).
`rotation-init.js` picks the active image before first paint, and `ImageShuffle`
handles later swaps. Add images to both `src/img/art/` and the component, with a
descriptive `alt` that names the work and artist.

Quotes work the same way via `[data-quote-stack]` and `QuoteShuffle`.

## Hidden pages

Two routes are intentionally unlinked:

- **`/now`** — `src/now.njk` renders the first entry in the `now` collection,
  populated from `src/content/now/`. Update the Markdown there.
- **`/links`** — `src/links.njk` plus `_data/links.js`.

Discovery state is centralised in `src/js/DiscoveryStore.js`
(`HIDDEN_ROUTES`, storage key `portfolio:hidden-routes:v1`). Adding a third
hidden page means updating that list and the copy in `DiscoveryUI.js`. If a new
hidden page shouldn't appear in the sitemap, exclude it like `/now` is excluded
in `src/sitemap.njk`.

## Images

- Project originals: `src/img/projects/<slug>/`
- Certificates: `src/img/certificates/`
- Art: `src/img/art/`
- Site graphics: `src/img/decor/`, `src/img/brand/`, `src/img/about/`,
  `src/img/tech/`

Images referenced from Eleventy templates are optimised into WebP/JPEG variants
next to the source. Files in `src/img` are also copied through, so keep originals
reasonably sized. SVG icons live under `src/img/tech/tech-icons.svg` and are
referenced by symbol id (`getTechIcon` maps names to ids).

## SEO odds and ends

- `tags: ['page']` is required for a page to enter the sitemap.
- The sitemap adds projects and experience records separately, and skips
  `/now.html` and the `/experience/` index.
- Canonical URLs strip `.html`; keep new pages consistent with that (flat output,
  redirect trailing slashes in `src/_redirects`).
- `robots.txt` and `_headers` are copied to the deploy root automatically.
