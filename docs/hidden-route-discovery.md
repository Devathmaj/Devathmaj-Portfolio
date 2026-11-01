# Hidden route discovery

## Integration

This is an Eleventy/WebC site enhanced with Taxi and GSAP. `src/js/index.js`
creates one `DiscoveryStore` and one `DiscoveryUI` for the document's lifetime.
The shared footer, navigation and announcement live outside Taxi's replaceable
view. Each renderer entry rehydrates the current hero and tracks the actual
`window.location.pathname`, after Taxi has updated the URL. This includes initial
loads, client navigation and history navigation.

`/now` and `/links` match exactly after trailing-slash normalization. Query
parameters and fragments do not affect pathname matching. `/nowhere` and
`/links/something` do not register discoveries.

## State and persistence

- Key: `portfolio:hidden-routes:v1`.
- Value: a JSON array containing only `now` and/or `links`, in canonical order.
- Initialization validates JSON, filters unknown IDs and deduplicates. It performs
  no storage write, so mounting cannot replace saved progress with an empty array.
- Registration rereads storage, merges saved progress, writes immediately, then
  queues an announcement with the post-registration count.
- The store exposes `discoveredRoutes`, `discoveredCount`, `isDiscovered`,
  `discoverRoute`, `trackPathname`, `discoveryNotice`,
  `dismissDiscoveryNotice`, and `subscribe` (which returns an unsubscribe function).
- Storage exceptions switch to an application-lifetime in-memory fallback.
- `storage` events update subscribers without queuing announcements. Normal
  synchronization performs no write. A missing ID from a competing write is
  merged back only when necessary, avoiding write loops. Removing/clearing the
  key resets other tabs; a reload resets the tab where storage was cleared.
- Web Locks serialize simultaneous registrations across tabs. Browsers without
  Web Locks use read/merge/write with event-based repair; localStorage alone
  cannot guarantee atomic first-writer selection in truly simultaneous legacy
  browser writes.
- `pageshow` refreshes persisted state for back/forward cache restoration.

No expiry, cookies, network requests or identifying information are involved.

## Navigation and presentation

The original five donut destinations remain the base list. Discovered routes
are real additional links and SVG paths; undiscovered routes have no partitions.
Final angles are **72° (five items), 60° (six), and 360/7° (seven)**.

GSAP interpolates segment weights whose sum stays one. Every animation frame
derives adjacent paths from shared angular boundaries and positions each label
at its segment midpoint. A new wedge grows as the existing wedges redistribute;
its label fades in. Reduced motion applies the final geometry immediately.
Existing paths and links retain their identity and delegated interactions.

The hero uses its text navigation, with Now revealed under Meta. The persistent
donut is accessed from interior pages; the hidden header is inert while the hero
is active. Opening/closing the donut preserves
focus, scroll locking, hover/current states and keyboard containment.

The checked-in hero had navigation rows but no separate Now component. The Now
reveal therefore reuses its `home-nav` list/link/description styling and the
existing Now page description. Its inert template is mounted only after
discovery. The Links template mounts under Garden in the footer; neither template
reserves an empty navigation item. The footer leads with the requested three exact
progress messages in a prominent, full-width ruled band, using large Louize Display
type and high-contrast paper text.

The footer progress band is a button. Activating it opens the discovery dialog on
demand, with copy for the current count: the invitation at 0/2, "Well spotted!"
plus the found URL at 1/2, and the detective send-off plus a list of all
discoveries at 2/2. The on-demand view never creates or clears a discovery notice,
so it can be reopened as often as the visitor likes. Automatic discovery
announcements keep their own copy and list what was just found.

Announcements use native `dialog`, the site's paper/ink colors, Louize Display,
existing rounded border and focus treatment. There is one dismissal action,
Escape/backdrop dismissal, a focus trap that also reaches the discovered links,
focus restoration, and an animated progress rule. Dismissal has a timer fallback
and reduced-motion handling. Announcement copy follows discovery count, so finding
Links first also works.

## Verification (Chrome 156, local production output)

| Scenario | Result |
| --- | --- |
| Fresh homepage: 0/2, no Now or Links, five full wedges | Passed |
| Direct `/now`, 1/2 announcement, immediate persistence | Passed |
| Taxi return home: Now reveal and six wedges | Passed |
| Refresh and repeat visits: no recurring announcement | Passed |
| Direct `/links`: 2/2 announcement and completion footer | Passed |
| Seven wedges; Links in footer, Now in hero | Passed |
| Links-first discovery order | Passed |
| Browser closed and relaunched with the same profile | Passed |
| New tab restores progress silently | Passed |
| Live cross-tab updates and no remote announcement | Passed |
| Simultaneous same-route and different-route registrations | Passed |
| Clear localStorage and reload; other tab resets live | Passed |
| `/nowhere` returns 404; unrelated routes do not discover | Passed |
| Trailing slashes, browser back/forward and Taxi navigation | Passed |
| Invalid JSON, wrong shapes, duplicates and unknown IDs | Passed |
| Blocked reads and quota/write failures | Passed (write failures in unit tests) |
| Existing wedge click, label click, hover, active state and focus trap | Passed |
| Animated ring coverage at intermediate frames | Passed |
| 320/390/768/1440px dialog and wheel containment | Passed |
| Reduced motion, theme styling and keyboard dismissal | Passed |

The final browser run had no uncaught page errors. Analytics and the external
music endpoint were isolated in browser tests. Mobile hero, footer, donut and
announcement screenshots were also inspected. React Strict Mode is not
applicable to this architecture; repeated/concurrent registrations are covered
by the idempotence tests.

Commands:

```sh
npm run build
npm run test:discovery
npx stylelint src/scss/components/_discovery.scss
```

The unit suite contains 12 passing tests. The browser suite contains two passing
end-to-end groups covering the scenarios above. Serve `_site` at
`http://127.0.0.1:8088`, then run:

```sh
node --test scripts/discovery.browser.test.js
```

The browser suite requires Chrome and an existing Playwright installation.
`PLAYWRIGHT_MODULE` can point to an external Playwright module URL;
`DISCOVERY_TEST_URL` overrides the server origin. No application dependency was added.

## Deployment

Cloudflare Pages uses `wrangler.toml` (`pages_build_output_dir = "_site"`) and
`npm run build`. Eleventy generates `now/index.html` and `links/index.html`, so
static directory index serving supports direct loads and refreshes, including
canonical trailing slashes. The local HTTP tests exercised these generated
files. No SPA catch-all rewrite is required. Other static hosts must publish the
entire `_site` directory and serve directory indexes. Live Cloudflare Pages
deployment was not performed.

## Files

Created:

- `src/js/DiscoveryStore.js`
- `src/js/DiscoveryUI.js`
- `src/_includes/discovery-notice.njk`
- `src/scss/components/_discovery.scss`
- `scripts/discovery.test.js`
- `scripts/discovery.browser.test.js`
- `docs/hidden-route-discovery.md`

Modified:

- `src/js/index.js`
- `src/js/SiteNavigation.js`
- `src/js/NavManager.js`
- `src/_components/home-hero.webc`
- `src/_components/page-nav.webc`
- `src/_includes/footer.njk`
- `src/_includes/layouts/base.njk`
- `src/scss/style.scss`
- `package.json`
- `wrangler.toml`

The production build also regenerated `_site` output.
