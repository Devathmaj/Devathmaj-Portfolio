# Code and infrastructure decorations

These SVG illustrations are original artwork authored for this site. They use
the existing ink/paper palette and require no external image service or license.
The network diagrams are decorative, not claims about deployed systems.

| Asset | Placement |
| --- | --- |
| `network-strip.svg` | Repeating `.page-header__bar` background |
| `terminal-rack.svg` | Wide first project-list panel |
| `infrastructure-composite.svg` | Shared background in project-list panels 2–4 |
| `ethernet-link.svg` | Image in project-list panel 5 |
| `network-topology.svg` | Shared background in project-list panels 6–7 |
| `server-rack.svg` | Narrow project-list panel 8 |
| `../../_includes/graphics/infrastructure-emblem.svg` | Inline shared footer illustration |

Container layout, clipping, borders, responsive visibility and transition
selectors are retained. `src/js/ProjectEntries.js` still calculates `--crown-height`
and `--collar-width` for the two shared backgrounds; those historical variable
names are animation/layout hooks, not the subject of the replacement artwork.
The header keeps the existing GSAP scroll-driven background position and
reduced-motion behavior. The footer keeps `currentColor` and the original
237 × 233 viewBox, including its intentional edge crop.
