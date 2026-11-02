# Social preview images

External previews are split by section, not per page:

| Section | `ogImageKey` | Pages | Master |
| --- | --- | --- | --- |
| Default | *(omitted)* | `/`, `/certificates`, `/links`, `/now`, `/experience/*`, `/404` | `src/meta/devathmaj-portfolio-preview.png` |
| Projects | `projects` | `/projects/` and every `/projects/<slug>/` page | `src/meta/devathmaj-project-preview.png` |
| About | `about` | `/about` | `src/meta/devathmaj-about-preview.png` |
| Contact | `contact` | `/contact` | `src/meta/devathmaj-contact-preview.png` |

Every page in a section shares that section's image. The title and description
still vary per page. `ogImageKey` is set in the page front matter (and in
`projects.11tydata.js` for all project pages); omitting it falls back to the
default portfolio image.

The tags are emitted by `src/_includes/layouts/base.njk` from the `ogImage`
object in `src/_data/site.json`:

```html
<meta property="og:image" content="https://devathmaj.me/meta/devathmaj-project-preview-1200x630.png?v=20261102">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Devathmaj A Kaliyathan — Projects">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://devathmaj.me/meta/devathmaj-project-preview-1200x630.png?v=20261102">
```

`?v=` is a cache buster: bump `ogImage.version` in `src/_data/site.json`
whenever any artwork changes.

## Files

Each master produces a set of derivatives:

| Suffix | Size | Use |
| --- | --- | --- |
| `-1200x630.png` | 1200×630 | Primary `og:image` / `twitter:image` |
| `-1200x630.jpg` | 1200×630 | JPEG fallback for tools that reject PNG |
| `-1200x1200.png` | 1200×1200 | Square cards and profiles that crop 1:1 |
| `-600x315.png` | 600×315 | Compact embeds and email signatures |

The portfolio master also gets `-1280x640.png` for the GitHub repository card.
The generator uses `contain` for the 2:1 and 1:1 variants so no part of the
artwork is cropped.

Regenerate all derivatives after replacing any master:

```bash
npm run social:preview
npm run build
```

Then commit and push; Cloudflare Pages deploys from `main` (see
[Deployment](deployment.md)).

## Platform checklist

Third-party sites cache previews. Changing the meta tags does not update an
existing card until that platform re-crawls the URL. After deploying, run every
item below once.

| Platform | What to do |
| --- | --- |
| **This site** | `npm run build`, then confirm the pages below carry their section image. |
| **LinkedIn** | Open <https://www.linkedin.com/post-inspector/>, enter each representative URL: `/`, `/projects/`, `/projects/confessit`, `/about`, `/contact`. Click **Inspect** and repeat for any URL shared before. |
| **Facebook / Messenger** | Open <https://developers.facebook.com/tools/debug/>, enter each representative URL, click **Scrape Again** until the new image appears. |
| **X / Twitter** | Use <https://cards-dev.twitter.com/validator> if available; otherwise publish a test post or DM each URL to yourself. X caches cards for roughly a week. |
| **WhatsApp** | No public debugger. Send each URL with the query string `?v=20261102` to a chat; the query forces a fresh unfurl. Cache is roughly a week. |
| **Telegram** | Message `@WebpageBot` with each URL (plus `?v=20261102`) and follow its prompts. |
| **Discord** | Post each URL with `?v=20261102` in a channel. Discord does not cache embeds globally; a new message/query string refreshes it. |
| **Slack** | Paste each URL with `?v=20261102` in a channel or DM. Slack caches unfurls per workspace; the query string bypasses the old entry. |
| **Google Search** | Run <https://search.google.com/test/rich-results> and URL Inspection in Search Console. Google chooses search thumbnails itself, so `og:image` is a hint, not a guarantee. |
| **GitHub** | Repository **Settings → General → Social preview → Edit**, upload `src/meta/devathmaj-portfolio-preview-1280x640.png`, then save. |
| **Resume / email signature / directories** | Upload the section’s `-1200x630.png`, or its `-1200x1200.png` where the surface is square. |

## Verifying

List each built page and the image it points at:

```powershell
Get-ChildItem _site -Recurse -Filter *.html |
  Select-String -Pattern 'og:image" content="([^"]+)"' |
  ForEach-Object {
    "$($_.Path.Replace("$PWD\_site\", '')) -> $($_.Matches.Groups[1].Value)"
  }
```

Expected groups:

- `/projects/*` → `devathmaj-project-preview-1200x630.png`
- `/about` → `devathmaj-about-preview-1200x630.png`
- `/contact` → `devathmaj-contact-preview-1200x630.png`
- everything else → `devathmaj-portfolio-preview-1200x630.png`

A quick live check:

```powershell
(Invoke-WebRequest https://devathmaj.me/projects/confessit).Content |
  Select-String -Pattern 'og:image|twitter:image'
```

Each image must return `200` with `Content-Type: image/png`:

```powershell
(Invoke-WebRequest https://devathmaj.me/meta/devathmaj-project-preview-1200x630.png).Headers
```
