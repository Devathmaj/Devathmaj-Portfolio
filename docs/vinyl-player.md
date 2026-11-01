# Homepage listening room

## Files

- `src/index.njk`: shared listening-room title, artwork/player pair, and the existing footer horizon.
- `src/_components/home-letter.webc`: original six artwork assets in a frame that matches the turntable panel.
- `src/_includes/vinyl-player.njk`: server-rendered collection, turntable and accessible controls.
- `src/scss/components/_vinyl-player.scss`: responsive two-room composition, player, physical disc, platter, tonearm and site-wide now-playing dock.
- `src/js/VinylPlayer.js`: controls, measured disc transport and route hand-off.
- `src/js/vinylAudio.js`: shared audio element, site-wide playback state, media-session metadata and the off-home now-playing dock.
- `lib/music.js`: central catalogue discovery and filename corrections, exposed through `src/_data/music.js`.

## Music catalogue

Add MP3, WAV or OGG files anywhere inside `src/music`. Eleventy discovers them at build time and copies them to `/music/` using its passthrough asset pipeline. No filesystem URLs or external hosting are used. `music-metadata` is a build-time dependency only.

Embedded title/artist/composer tags take precedence over filename information. Encodings with matching normalized filenames or title/artist metadata are grouped into one logical record. For example, tagged `VLC.mp3` and untagged `alternates/VLC.wav` share the tagged metadata and supply two alternative sources. Unrelated recordings should have distinct filenames and metadata. This is metadata-based grouping, not acoustic fingerprinting.

The supplied directory contains eight records. `Coexistenz` has embedded title/artist tags; HoliznaCC0 and Beethoven attribution comes from filenames. Canon in D Major, Für Elise and Sweet Serene have no performer attribution in their files, so they explicitly display **Artist uncredited**. Presentation corrections belong in `filenameMetadata` in `lib/music.js`; update attribution only when established. Durations and progress come from the actual browser media element.

## Transport and lifecycle

The player owns one shared `<audio>` element. It is attached to `<body>`, outside Taxi's router target, so a selected record keeps playing while the visitor moves between pages. Native events determine playing, paused, buffering and error states. Format selection uses `canPlayType`; failed sources advance to the next encoding. Explicit play retries a failed load, and autoplay-policy rejection presents a play action. The transport (record, position, play/pause intent, volume and mute) is snapshotted to `sessionStorage`, so a soft or hard reload restores the same record at the same position and attempts to resume it. If the browser's autoplay policy refuses the automatic resume, the record stays paused at that position and continues on the next interaction or explicit play. The crate is shuffled on every visit, and playback, next/previous and auto-advance follow that shuffled order. At the end of a track, the next record in that order plays and the collection wraps.

While a record is active, other pages show a compact now-playing dock with play/pause and stop; the full turntable only exists on the home page. On returning home, the player adopts the shared audio element and restores the selected record, platter position, progress, arm and rotation without restarting the song. Volume and mute survive route changes and reloads within the session. Media Session metadata exposes the current record to operating-system controls.

Each record has one physical `.vinyl-disc` DOM element. It moves from its collection well into a measured flight wrapper, then into the platter slot. The old disc returns to its original well first. The recessed miniature behind a loaded record marks its place in the collection.

The approximately 3.2-second sequence fades and decelerates, raises the arm, lifts/returns the old disc, exposes the empty platter, retrieves the selected disc, aligns/settles it, updates metadata, and lowers the arm. Only then is playback requested. Web Animations handles continuous rotation; existing GSAP handles brief speed ramps and measured transforms. Reduced motion uses a brief empty-platter exchange and no rotating vinyl.

While a physical transfer is in progress, selections update a single latest-requested index. Transfers never overlap; intermediate queued choices are skipped, and audio starts only when the latest chosen record is loaded. A route change destroys only the page-specific UI, tweens and listeners; if it interrupts a transfer, the newly selected record is loaded and started audio-only so playback continues and the platter matches on return.

At 1200px and above the artwork and turntable occupy equal columns and stretch to the same height; the shared "A little room for something beautiful." title sits above both. Below that width they stack in the same order, with the now-playing dock remaining fixed to the viewport corner on other pages.

## Checks

```sh
npm run test:music
npm run lint:vinyl
npm run typecheck:vinyl
npm run build
```

The catalogue tests cover real asset resolution, metadata precedence, nested discovery and mixed tagged/untagged alternate encodings. Browser verification covered all eight audio files, controls, actual seeking/duration, record identity during transport, empty platter, rapid selection, track completion, format fallback, failed loads/retry, policy rejection, reduced motion, keyboard focus, widths from 280 to 1920px, and continuous playback across Taxi navigations (including pausing/resuming from the off-home dock and leaving mid-transfer).

Existing local-preview console errors originate in the Tidal Cloudflare Function request and `ExperienceWaterfall`; neither is emitted by the player. The page previously overflowed horizontally at 320px because the fixed-size "Projects" heading could not fit; it now uses a fluid `clamp()` size so the whole page fits from 280px upward, with or without the listening room.
