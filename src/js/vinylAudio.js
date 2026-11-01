/**
 * Site-wide vinyl playback.
 *
 * The audio element lives outside the Taxi router target so a selected record
 * keeps playing while the visitor moves between pages. The homepage
 * VinylPlayer adopts this element and this shared state whenever it mounts.
 */

import { assetManager } from './assets/AssetManager';

const VOLUME_KEY = 'devathmaj-portfolio:vinyl-volume';
const MUTED_KEY = 'devathmaj-portfolio:vinyl-muted';
const PLAYBACK_KEY = 'devathmaj-portfolio:vinyl-playback';
const PLAYBACK_VERSION = 1;
const PLAYBACK_MAX_AGE = 12 * 60 * 60 * 1000;
const PLAYBACK_SAVE_INTERVAL = 2000;

let lastSavedAt = 0;
/** @type {string | null} */
let lastSavedId = null;
/** @type {((event: Event) => void) | null} */
let gestureResume = null;

const readVolume = () => {
  try {
    const stored = window.sessionStorage.getItem(VOLUME_KEY);
    if (stored === null) return 0.7;
    const value = Number(stored);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.7;
  } catch {
    return 0.7;
  }
};

const readMuted = () => {
  try {
    return window.sessionStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * @param {string} key
 * @param {string} value
 */
const store = (key, value) => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Private browsing can refuse storage; playback still works for this page.
  }
};

/** @typedef {{ id: string, title: string, artist: string, colour: string, sources: {src: string, type: string}[] }} VinylTrack */

/** @param {VinylTrack} track */
const serializeTrack = (track) => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  colour: track.colour,
  sources: track.sources.map(({ src, type }) => ({ src, type })),
});

/** @param {unknown} track @returns {track is VinylTrack} */
const isTrack = (track) => {
  const candidate = /** @type {Partial<VinylTrack>} */ (track);
  return Boolean(
    candidate &&
    typeof candidate.id === 'string' &&
    candidate.id &&
    Array.isArray(candidate.sources) &&
    candidate.sources.every((source) => source && typeof source.src === 'string' && typeof source.type === 'string'),
  );
};

/** @typedef {{ version: number, track: VinylTrack, playlist?: VinylTrack[], currentTime?: number, playing?: boolean, wantsPlayback?: boolean, volume?: number, muted?: boolean, savedAt: number }} SavedPlayback */

/** @returns {SavedPlayback | null} */
const readSavedPlayback = () => {
  try {
    const raw = window.sessionStorage.getItem(PLAYBACK_KEY);
    if (!raw) return null;
    const saved = /** @type {SavedPlayback | null} */ (JSON.parse(raw));
    if (saved?.version !== PLAYBACK_VERSION ||
        !Number.isFinite(saved.savedAt) ||
        Date.now() - saved.savedAt > PLAYBACK_MAX_AGE) {
      return null;
    }
    if (!isTrack(saved.track) || !saved.track.sources.length) return null;
    if (saved.playlist !== undefined &&
        (!Array.isArray(saved.playlist) || !saved.playlist.every(isTrack))) {
      return null;
    }
    return saved;
  } catch {
    return null;
  }
};

/**
 * Persist the transport so a reload can pick the record back up. Time updates
 * are throttled; explicit transport changes and page hides force a write.
 * @param {{ force?: boolean }} [options]
 */
function savePlayback({ force = false } = {}) {
  const audio = playback.audio;
  if (!playback.session || !playback.currentId || !audio?.src) return;
  const track = trackById(playback.currentId);
  if (!track) return;

  const now = Date.now();
  const changedTrack = track.id !== lastSavedId;
  if (!force && !changedTrack && now - lastSavedAt < PLAYBACK_SAVE_INTERVAL) return;

  lastSavedAt = now;
  lastSavedId = track.id;
  const snapshot = {
    version: PLAYBACK_VERSION,
    track: serializeTrack(track),
    playlist: playback.playlist.filter(isTrack).map(serializeTrack),
    currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    playing: !audio.paused,
    wantsPlayback: playback.wantsPlayback,
    volume: playback.volume,
    muted: playback.muted,
    savedAt: now,
  };
  store(PLAYBACK_KEY, JSON.stringify(snapshot));
}

const clearSavedPlayback = () => {
  try {
    window.sessionStorage.removeItem(PLAYBACK_KEY);
  } catch {
    // Storage is best-effort.
  }
  lastSavedAt = 0;
  lastSavedId = null;
};

const disarmGestureResume = () => {
  if (!gestureResume) return;
  document.removeEventListener('pointerdown', gestureResume, true);
  document.removeEventListener('keydown', gestureResume, true);
  gestureResume = null;
};

/**
 * Browsers may refuse play() after a reload until the visitor interacts. Resume
 * on the first interaction that isn't itself a player control, so pressing the
 * play button still behaves exactly as expected.
 */
const armGestureResume = () => {
  if (gestureResume) return;
  const controls = '[data-play], [data-dock-toggle], [data-record], [data-previous], [data-next], [data-dock-stop]';
  /** @param {Event} event */
  gestureResume = (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(controls)) return;
    disarmGestureResume();
    const audio = getAudio();
    if (playback.wantsPlayback && audio.paused) {
      resumeShared();
    }
  };
  document.addEventListener('pointerdown', gestureResume, true);
  document.addEventListener('keydown', gestureResume, true);
};

export const playback = {
  /** @type {HTMLAudioElement | null} */
  audio: null,
  /** @type {VinylTrack[]} */
  playlist: [],
  /** @type {string | null} */
  currentId: null,
  /** True once the visitor has chosen or started listening. */
  session: false,
  playing: false,
  wantsPlayback: false,
  volume: readVolume(),
  muted: readMuted(),
  /** Saved position remembered before the media is loaded. */
  pendingTime: 0,
  /** True while a homepage turntable is mounted and owns the transport. */
  attached: false,
  /** @type {HTMLElement | null} */
  dock: null,
  /** @type {HTMLElement | null} */
  dockTitle: null,
  /** @type {HTMLElement | null} */
  dockArtist: null,
  /** @type {HTMLButtonElement | null} */
  dockToggle: null,
  /** @type {string | null} */
  mediaId: null,
  mediaReady: false,
};

const announce = () => {
  document.dispatchEvent(new CustomEvent('vinyl:change'));
};

/** @param {string} type */
const canPlay = (type) => !type || playback.audio?.canPlayType(type) !== '';

/** @param {VinylTrack} track */
const playableSources = (track) => track.sources.filter((source) => canPlay(source.type));

/**
 * Seek to a remembered position once the browser knows the media duration.
 * Nothing is fetched here; the caller owns loading the source.
 * @param {HTMLAudioElement} audio
 * @param {number} time
 */
const applyPendingTime = (audio, time) => {
  const resumeAt = Number(time) > 0 ? Number(time) : 0;
  if (!resumeAt) return;

  const seek = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Math.min(resumeAt, Math.max(0, audio.duration - 0.25));
    }
    if (playback.pendingTime === resumeAt) playback.pendingTime = 0;
  };

  if (audio.readyState >= 1) seek();
  else audio.addEventListener('loadedmetadata', seek, { once: true });
};

/**
 * Move a track's audio into the shared element. Used by the off-home dock for
 * ended-track advance and media controls.
 * @param {VinylTrack} track
 * @param {{ autoplay?: boolean, time?: number }} [options]
 */
function loadSharedTrack(track, { autoplay = false, time = 0 } = {}) {
  const audio = getAudio();
  const sources = playableSources(track);
  if (!sources.length) return false;

  playback.currentId = track.id;
  playback.session = true;
  playback.pendingTime = time > 0 ? time : playback.pendingTime;
  audio.preload = 'metadata';
  audio.src = assetManager.getPlaybackUrl(sources[0].src);
  audio.load();
  audio.volume = playback.muted ? 0 : playback.volume;
  applyPendingTime(audio, playback.pendingTime);
  if (autoplay) {
    audio.play().catch(() => {
      playback.wantsPlayback = false;
    });
  }
  updateMediaSession();
  announce();
  return true;
}

/**
 * Rebuild the shared transport from the previous document after a reload.
 * Playback is attempted immediately; if the browser's autoplay policy refuses,
 * the record stays paused at the saved position and resumes on the next
 * interaction or explicit play.
 * @returns {boolean} Whether saved playback was adopted.
 */
export function restorePlayback() {
  const saved = readSavedPlayback();
  if (!saved) return false;

  const track = saved.track;
  const audio = getAudio();
  const playlist = Array.isArray(saved.playlist) ? saved.playlist.filter(isTrack) : [];
  if (!playlist.some((entry) => entry.id === track.id)) playlist.push(track);

  playback.playlist = playlist;
  playback.currentId = track.id;
  playback.session = true;
  playback.wantsPlayback = Boolean(saved.wantsPlayback);
  playback.playing = false;
  playback.volume = readVolume();
  playback.muted = readMuted();
  lastSavedId = track.id;
  lastSavedAt = Date.now();

  const sources = playableSources(track);
  if (!sources.length) return false;

  const resumeAt = typeof saved.currentTime === 'number' && Number.isFinite(saved.currentTime)
    ? Math.max(0, saved.currentTime)
    : 0;
  playback.pendingTime = resumeAt;

  audio.volume = playback.muted ? 0 : playback.volume;
  audio.muted = playback.muted;

  // A paused record is restored without touching the network or the media
  // pipeline. The source is attached on the next play or record selection.
  if (saved.playing) {
    audio.preload = 'metadata';
    audio.src = assetManager.getPlaybackUrl(sources[0].src);
    audio.load();

    const resumeSaved = () => {
      applyPendingTime(audio, resumeAt);
      if (!playback.wantsPlayback) return;
      audio.play().catch((error) => {
        playback.playing = false;
        announce();
        if (!(error instanceof DOMException) || error.name === 'NotAllowedError') {
          armGestureResume();
        }
      });
    };
    if (audio.readyState >= 1) resumeSaved();
    else audio.addEventListener('loadedmetadata', resumeSaved, { once: true });
  } else if (playback.wantsPlayback) {
    // The browser refused autoplay when the page was left. Wait for a gesture
    // instead of loading the file now.
    armGestureResume();
  }

  updateMediaSession();
  announce();

  return true;
}

/** @param {string | null} id */
const trackById = (id) => playback.playlist.find((track) => track.id === id) || null;

const updateMediaSession = () => {
  if (!('mediaSession' in navigator)) return;
  if (!playback.session) {
    if (playback.mediaId !== null) {
      navigator.mediaSession.metadata = null;
      playback.mediaId = null;
    }
    return;
  }
  const track = trackById(playback.currentId);
  if (!track) {
    if (playback.mediaId !== null) {
      navigator.mediaSession.metadata = null;
      playback.mediaId = null;
    }
    return;
  }

  if (playback.mediaId !== track.id) {
    playback.mediaId = track.id;
    if ('MediaMetadata' in window) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: 'The Listening Room',
      });
    }
  }
  if (playback.mediaReady) return;
  playback.mediaReady = true;

  const audio = getAudio();
  try {
    navigator.mediaSession.setActionHandler('play', () => {
      resumeShared();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      playback.wantsPlayback = false;
      audio.pause();
    });
    navigator.mediaSession.setActionHandler('stop', () => stopSharedPlayback());
    navigator.mediaSession.setActionHandler('nexttrack', () => stepSharedTrack(1));
    navigator.mediaSession.setActionHandler('previoustrack', () => stepSharedTrack(-1));
  } catch {
    // Older implementations expose only a subset of actions.
  }
};

/** @param {number} direction */
const stepSharedTrack = (direction) => {
  if (playback.attached) return;
  if (!playback.playlist.length || !playback.currentId) return;
  const index = playback.playlist.findIndex((track) => track.id === playback.currentId);
  const next = playback.playlist[(index + direction + playback.playlist.length) % playback.playlist.length];
  if (next) loadSharedTrack(next, { autoplay: true });
};

/**
 * Start or continue the shared transport. A restored record whose source was
 * never attached is loaded here, so nothing is fetched before a real gesture.
 */
export function resumeShared() {
  const track = trackById(playback.currentId);
  if (!track) return false;

  playback.wantsPlayback = true;
  const audio = getAudio();

  if (!audio.src) {
    return loadSharedTrack(track, {
      autoplay: true,
      time: playback.pendingTime,
    });
  }

  applyPendingTime(audio, playback.pendingTime);
  audio.play().catch((error) => {
    playback.playing = false;
    announce();
    if (!(error instanceof DOMException) || error.name === 'NotAllowedError') {
      armGestureResume();
    }
  });
  return true;
}

function stopSharedPlayback() {
  const audio = getAudio();
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  playback.currentId = null;
  playback.session = false;
  playback.playing = false;
  playback.wantsPlayback = false;
  disarmGestureResume();
  clearSavedPlayback();
  updateMediaSession();
  syncVinylDock();
  announce();
}

const buildDock = () => {
  const dock = document.createElement('aside');
  dock.className = 'vinyl-dock';
  dock.setAttribute('aria-label', 'Now playing');
  dock.hidden = true;
  dock.innerHTML = `
    <button class="vinyl-dock__toggle" type="button" aria-label="Pause" data-dock-toggle>
      <span data-dock-pause><svg class="vinyl-dock__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><path d="M8 5v14M16 5v14"/></svg></span>
      <span data-dock-play hidden><svg class="vinyl-dock__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="m8 5 11 7-11 7Z"/></svg></span>
    </button>
    <span class="vinyl-dock__meta">
      <span class="vinyl-dock__title" data-dock-title></span>
      <span class="vinyl-dock__artist" data-dock-artist></span>
    </span>
    <button class="vinyl-dock__stop" type="button" aria-label="Stop listening" data-dock-stop>
      <svg class="vinyl-dock__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>
    </button>`;

  playback.dock = dock;
  playback.dockTitle = dock.querySelector('[data-dock-title]');
  playback.dockArtist = dock.querySelector('[data-dock-artist]');
  playback.dockToggle = dock.querySelector('[data-dock-toggle]');

  dock.querySelector('[data-dock-toggle]')?.addEventListener('click', () => {
    const audio = getAudio();
    if (audio.paused) {
      resumeShared();
    } else {
      playback.wantsPlayback = false;
      audio.pause();
    }
  });
  dock.querySelector('[data-dock-stop]')?.addEventListener('click', () => stopSharedPlayback());

  document.body.append(dock);
};

export function syncVinylDock() {
  const active = playback.session && Boolean(playback.currentId);
  const onHome = window.location.pathname === '/' || window.location.pathname === '';
  if (!active || onHome) {
    if (playback.dock) playback.dock.hidden = true;
    return;
  }
  if (!playback.dock || !playback.dock.isConnected) buildDock();

  const track = trackById(playback.currentId);
  if (!track || !playback.dock) return;
  playback.dock.hidden = false;
  if (playback.dockTitle) playback.dockTitle.textContent = track.title;
  if (playback.dockArtist) playback.dockArtist.textContent = track.artist;
  if (playback.dockToggle) {
    playback.dockToggle.setAttribute('aria-label', playback.playing ? 'Pause' : 'Play');
    const pauseIcon = playback.dockToggle.querySelector('[data-dock-pause]');
    const playIcon = playback.dockToggle.querySelector('[data-dock-play]');
    if (pauseIcon) pauseIcon.toggleAttribute('hidden', !playback.playing);
    if (playIcon) playIcon.toggleAttribute('hidden', playback.playing);
  }
}

export function syncVinylState(patch = {}) {
  Object.assign(playback, patch);
  try {
    store(VOLUME_KEY, String(playback.volume));
    store(MUTED_KEY, playback.muted ? '1' : '0');
  } catch {
    // Storage is best-effort.
  }
  savePlayback();
  updateMediaSession();
  syncVinylDock();
}

/** The single audio element, detached from the page view that created it. */
export function getAudio() {
  if (playback.audio) return playback.audio;

  const audio = document.createElement('audio');
  audio.className = 'vinyl-audio';
  // Nothing is fetched until the visitor selects or resumes a record.
  audio.preload = 'none';
  audio.volume = playback.muted ? 0 : playback.volume;
  audio.muted = playback.muted;
  document.body.append(audio);

  audio.addEventListener('playing', () => {
    playback.playing = true;
    playback.session = true;
    playback.wantsPlayback = true;
    disarmGestureResume();
    savePlayback({ force: true });
    syncVinylDock();
    announce();
  });
  audio.addEventListener('pause', () => {
    playback.playing = false;
    savePlayback({ force: true });
    syncVinylDock();
    announce();
  });
  audio.addEventListener('timeupdate', () => savePlayback());
  audio.addEventListener('seeked', () => savePlayback({ force: true }));
  audio.addEventListener('ended', () => {
    savePlayback({ force: true });
    if (playback.attached || !playback.wantsPlayback) return;
    stepSharedTrack(1);
  });

  playback.audio = audio;
  return audio;
}

// The dock is a site-wide affordance, not part of the homepage turntable.
document.addEventListener('vinyl:change', syncVinylDock);

// Flush the transport before the document goes away so a reload can resume it.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') savePlayback({ force: true });
});
window.addEventListener('pagehide', () => savePlayback({ force: true }));
window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !playback.wantsPlayback) return;
  const audio = playback.audio;
  if (!audio || audio.paused) resumeShared();
});
