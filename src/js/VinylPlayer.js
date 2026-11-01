import gsap from 'gsap';

import { getAudio, playback, syncVinylState, syncVinylDock } from './vinylAudio';
import { assetManager } from './assets/AssetManager';

/** @param {number} seconds */
const timeLabel = (seconds) => {
  if (!Number.isFinite(seconds)) return '--:--';
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};

/** Shuffle in place with Fisher–Yates. @template T @param {T[]} items @returns {T[]} */
const shuffle = (items) => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
};

/** @template {Element} T @param {ParentNode} root @param {string} selector @returns {T} */
function required(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing vinyl player element: ${selector}`);
  return /** @type {T} */ (element);
}

/** A single media element and a serialized, latest-selection-wins record transport. */
export default class VinylPlayer {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    /** @template {Element} T @param {string} selector @returns {T} */
    const find = (selector) => required(root, selector);
    this.find = find;
    this.audio = getAudio();
    this.shared = playback;
    /** @type {HTMLInputElement} */
    this.seek = find('[data-seek]');
    /** @type {HTMLInputElement} */
    this.volume = find('[data-volume]');
    /** @type {HTMLButtonElement} */
    this.playButton = find('[data-play]');
    /** @type {HTMLButtonElement} */
    this.muteButton = find('[data-mute]');
    /** @type {HTMLElement} */
    this.slot = find('.vinyl-player__slot');
    /** @type {HTMLElement} */
    this.arm = find('.vinyl-player__tonearm');
    /** @type {HTMLElement} */
    this.list = find('.vinyl-player__records');
    /** @type {HTMLElement} */
    this.status = find('[data-status]');
    // A new crate order every visit; playback, next/previous and auto-advance
    // all follow this shuffled list.
    shuffle(Array.from(this.list.children)).forEach((record) => this.list.append(record));
    this.buttons = Array.from(root.querySelectorAll('button[data-record]'));
    this.tracks = this.buttons.map((button) => {
      const element = /** @type {HTMLButtonElement} */ (button);
      return {
        id: element.dataset.id || '',
        title: element.dataset.title || '',
        artist: element.dataset.artist || '',
        colour: element.style.getPropertyValue('--label-colour'),
        well: required(element, '.vinyl-player__well'),
        disc: required(element, '.vinyl-disc'),
        sources: Array.from(element.querySelectorAll('[data-source]')).map((source) => ({
          src: source.getAttribute('data-source') || '', type: source.getAttribute('data-type') || '',
        })),
      };
    });
    this.playlist = this.tracks.map(({ id, title, artist, colour, sources }) => ({
      id, title, artist, colour, sources,
    }));
    const restoredIndex = this.tracks.findIndex((track) => track.id === this.shared.currentId);
    this.resumed = restoredIndex >= 0 && Boolean(this.audio.src) && this.shared.session;
    this.current = this.resumed ? restoredIndex : 0;
    this.requested = this.current;
    this.sourceIndex = 0;
    this.busy = false;
    this.destroyed = false;
    this.wantsPlayback = false;
    this.playing = false;
    this.envelope = { gain: 1 };
    this.events = new AbortController();
    this.motion = new Set();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    /** @type {Animation | null} */
    this.rotation = null;
    this.playAttempt = 0;
    this.armAttempt = 0;

    this.tracks.forEach((track) => {
      /** @type {HTMLElement} */ (track.disc).style.setProperty('--label-colour', track.colour);
    });
    this.slot.append(this.tracks[this.current].disc);
    this.createRotation();
    /** @param {EventTarget} element @param {string} event @param {EventListener} listener */
    const listen = (element, event, listener) => element.addEventListener(event, listener, { signal: this.events.signal });

    this.buttons.forEach((button, index) => listen(button, 'click', () => this.select(index)));
    listen(this.playButton, 'click', () => this.togglePlayback());
    listen(find('[data-previous]'), 'click', () => this.select((this.requested - 1 + this.tracks.length) % this.tracks.length));
    listen(find('[data-next]'), 'click', () => this.select((this.requested + 1) % this.tracks.length));
    listen(this.seek, 'input', () => {
      if (!this.busy && Number.isFinite(this.audio.duration)) {
        this.audio.currentTime = Number(this.seek.value);
        this.updateProgress();
      }
    });
    listen(this.volume, 'input', () => {
      this.audio.muted = Number(this.volume.value) === 0;
      this.applyVolume();
      this.syncMute();
      this.syncShared();
    });
    listen(this.muteButton, 'click', () => {
      if (Number(this.volume.value) === 0) this.volume.value = '0.7';
      this.audio.muted = !this.audio.muted;
      this.applyVolume();
      this.syncMute();
      this.syncShared();
    });
    listen(this.audio, 'timeupdate', () => this.updateProgress());
    listen(this.audio, 'durationchange', () => this.updateProgress());
    listen(this.audio, 'loadedmetadata', () => this.updateProgress());
    listen(this.audio, 'playing', () => {
      if (!this.wantsPlayback) { this.audio.pause(); return; }
      this.playing = true;
      this.setPhase('playing');
      this.setStatus(`Playing ${this.tracks[this.current].title}.`);
      this.spin(true);
      this.setArm(true);
      this.syncControls();
      this.fade(1, 0.45);
    });
    listen(this.audio, 'pause', () => {
      this.playing = false;
      this.syncControls();
      if (!this.busy && !this.destroyed && this.root.dataset.phase !== 'error') {
        this.spin(false);
        this.setArm(false);
        this.setPhase('paused');
      }
    });
    listen(this.audio, 'waiting', () => {
      if (!this.wantsPlayback || this.busy) return;
      this.playing = false;
      this.spin(false);
      this.setArm(false);
      this.setPhase('loading');
      this.setStatus('Waiting for the audio…');
      this.syncControls();
    });
    listen(this.audio, 'ended', () => {
      this.playing = false;
      this.syncControls();
      if (!this.busy) this.select((this.current + 1) % this.tracks.length);
    });
    listen(this.audio, 'error', () => this.handleSourceError());
    listen(this.reducedMotion, 'change', () => {
      if (this.reducedMotion.matches) this.rotation?.pause();
      else if (this.playing) this.spin(true);
    });

    root.querySelectorAll('button, [data-volume]').forEach((control) => control.removeAttribute('disabled'));
    this.volume.value = String(this.shared.volume);
    this.audio.muted = this.shared.muted;
    this.shared.attached = true;
    if (this.resumed) {
      this.restoreSession();
    } else {
      this.loadTrack();
      this.applyVolume();
      this.syncControls();
    }
    this.syncShared();
  }

  /** Re-attach the homepage UI to audio that kept playing while browsing. */
  restoreSession() {
    const track = this.tracks[this.current];
    this.find('[data-track-title]').textContent = track.title;
    this.find('[data-track-artist]').textContent = track.artist;
    this.sources = track.sources.filter((source) => this.audio.canPlayType(source.type));
    const currentSource = this.audio.currentSrc || this.audio.src;
    const matched = this.sources.findIndex((source) => {
      try {
        const plain = new URL(source.src, window.location.href).href;
        const cached = new URL(
          assetManager.getPlaybackUrl(source.src),
          window.location.href,
        ).href;
        return currentSource === plain || currentSource === cached;
      } catch {
        return false;
      }
    });
    this.sourceIndex = Math.max(0, matched);
    this.envelope.gain = 1;
    this.volume.style.setProperty('--progress', `${Number(this.volume.value) * 100}%`);
    this.syncMute();
    this.updateProgress();

    if (!this.audio.paused) {
      this.playing = true;
      this.wantsPlayback = true;
      this.setPhase('playing');
      this.setStatus(`Playing ${track.title}.`);
      this.arm.dataset.arm = 'resting';
      gsap.set(this.arm, { rotation: 26, y: 0 });
      if (!this.reducedMotion.matches && this.rotation) {
        this.rotation.playbackRate = 1;
        this.rotation.play();
      }
    } else {
      this.playing = false;
      this.wantsPlayback = Boolean(this.shared.wantsPlayback);
      this.setPhase(this.wantsPlayback ? 'paused' : 'idle');
      this.setStatus(this.wantsPlayback
        ? 'Paused. Press play to continue where you left off.'
        : 'Record ready. Press play to continue.');
    }
    this.applyVolume();
    this.syncControls();
  }

  /** Publish transport state so it can outlive this page instance. */
  syncShared() {
    this.shared.playlist = this.playlist;
    this.shared.currentId = this.tracks[this.current]?.id ?? null;
    this.shared.playing = this.playing;
    this.shared.wantsPlayback = this.wantsPlayback;
    this.shared.volume = Number(this.volume.value);
    this.shared.muted = this.audio.muted;
    syncVinylState();
    syncVinylDock();
  }

  /** @param {string} message */
  setStatus(message) { this.status.textContent = message; }
  /** @param {string} phase */
  setPhase(phase) { this.root.dataset.phase = phase; }

  /** Keep cancellable GSAP work local to the component's route lifetime.
   * @param {gsap.TweenTarget} target @param {gsap.TweenVars} vars */
  tween(target, vars) {
    return new Promise((resolve) => {
      const done = () => { this.motion.delete(animation); resolve(undefined); };
      const animation = gsap.to(target, { ...vars, onComplete: done, onInterrupt: done });
      this.motion.add(animation);
    });
  }

  createRotation() {
    this.rotation?.cancel();
    const face = required(this.slot, '.vinyl-disc__face');
    const matrix = new DOMMatrixReadOnly(getComputedStyle(face).transform);
    const angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    this.rotation = face.animate(
      [{ transform: `rotate(${angle}deg)` }, { transform: `rotate(${angle + 360}deg)` }],
      { duration: 1800, iterations: Infinity, easing: 'linear' },
    );
    this.rotation.pause();
  }

  /** @param {boolean} on */
  async spin(on) {
    const rotation = this.rotation;
    if (!rotation) return;
    gsap.killTweensOf(rotation);
    if (this.reducedMotion.matches) { rotation.pause(); return; }
    if (on) {
      rotation.playbackRate = 0;
      rotation.play();
      await this.tween(rotation, { playbackRate: 1, duration: 0.6, ease: 'power1.inOut' });
    } else {
      await this.tween(rotation, { playbackRate: 0, duration: 0.45, ease: 'power1.out' });
      if (!this.playing || this.busy) rotation.pause();
    }
  }

  /** @param {boolean} down */
  async setArm(down) {
    const attempt = ++this.armAttempt;
    gsap.killTweensOf(this.arm);
    this.arm.dataset.arm = down ? 'lowering' : 'raising';
    await this.tween(this.arm, {
      rotation: down ? 26 : -7,
      y: down ? 0 : -3,
      duration: this.reducedMotion.matches ? 0.01 : 0.3,
      ease: 'power2.inOut',
    });
    if (!this.destroyed && attempt === this.armAttempt) this.arm.dataset.arm = down ? 'resting' : 'raised';
  }

  applyVolume() {
    this.audio.volume = Math.max(0, Math.min(1, Number(this.volume.value) * this.envelope.gain));
    this.volume.style.setProperty('--progress', `${Number(this.volume.value) * 100}%`);
  }

  syncMute() {
    this.muteButton.setAttribute('aria-pressed', String(this.audio.muted));
    this.muteButton.setAttribute('aria-label', this.audio.muted ? 'Unmute' : 'Mute');
  }

  /** @param {number} gain @param {number} duration */
  fade(gain, duration) {
    gsap.killTweensOf(this.envelope);
    return this.tween(this.envelope, { gain, duration, ease: 'none', onUpdate: () => this.applyVolume() });
  }

  loadTrack() {
    this.sourceIndex = 0;
    const track = this.tracks[this.current];
    this.sources = track.sources.filter((source) => this.audio.canPlayType(source.type));
    this.find('[data-track-title]').textContent = track.title;
    this.find('[data-track-artist]').textContent = track.artist;
    this.seek.value = '0';
    this.seek.disabled = true;
    this.find('[data-current-time]').textContent = '0:00';
    this.find('[data-duration]').textContent = '--:--';
    if (!this.sources.length) { this.fail('This browser cannot play this record. Please try another.'); return; }
    this.audio.preload = 'metadata';
    this.audio.src = assetManager.getPlaybackUrl(this.sources[0].src);
    this.audio.load();
  }

  handleSourceError() {
    if (this.destroyed) return;
    this.playing = false;
    this.spin(false);
    this.setArm(false);
    this.syncControls();
    const source = this.sources?.[++this.sourceIndex];
    if (source) {
      this.audio.preload = 'metadata';
      this.audio.src = assetManager.getPlaybackUrl(source.src);
      this.audio.load();
      if (this.wantsPlayback) this.startPlayback();
    } else {
      this.fail('This record could not be loaded. Press play to retry, or choose another.');
    }
  }

  /** @param {string} message */
  fail(message) {
    this.wantsPlayback = false;
    this.playing = false;
    this.audio.pause();
    this.spin(false);
    this.setArm(false);
    this.setPhase('error');
    this.setStatus(message);
    this.syncControls();
  }

  async startPlayback() {
    if (this.destroyed || !this.sources?.length) return;
    assetManager.prioritizeTrack(this.tracks[this.current].id);
    const attempt = ++this.playAttempt;
    this.wantsPlayback = true;
    this.shared.session = true;
    this.envelope.gain = 0;
    this.applyVolume();
    this.setStatus('Lowering the needle…');
    try {
      // Called directly by the play button; never on initial page load.
      await this.audio.play();
    } catch (error) {
      if (this.destroyed || attempt !== this.playAttempt || !this.wantsPlayback) return;
      const name = error instanceof Error ? error.name : '';
      if (name === 'AbortError' || this.audio.error) return;
      this.fail(name === 'NotAllowedError'
        ? 'Your record is ready. Press play to begin listening.'
        : 'This record could not be played. Press play to retry, or choose another.');
    }
  }

  pause() {
    this.playAttempt += 1;
    this.wantsPlayback = false;
    this.playing = false;
    this.audio.pause();
    this.spin(false);
    this.setArm(false);
    this.setPhase('paused');
    this.setStatus('Paused. Stay a little longer.');
    this.syncControls();
  }

  togglePlayback() {
    if (this.busy) return;
    if (this.wantsPlayback && !this.audio.paused) this.pause();
    else {
      if (this.audio.error) this.loadTrack();
      this.startPlayback();
    }
  }

  /** @param {number} index */
  select(index) {
    if (this.destroyed) return;
    this.requested = index;
    assetManager.prioritizeTrack(this.tracks[index].id);
    this.syncControls();
    if (this.busy) {
      this.setStatus(`Next on the platter: ${this.tracks[index].title}.`);
      return;
    }
    if (index === this.current) {
      if (this.audio.paused) this.togglePlayback();
      return;
    }
    this.runQueue();
  }

  async runQueue() {
    this.busy = true;
    this.syncControls();
    try {
      while (!this.destroyed) {
        if (this.requested !== this.current) {
          await this.replace(this.requested);
          continue;
        }
        if (this.root.dataset.phase !== 'error') this.startPlayback();
        if (this.requested === this.current) break;
      }
    } catch (error) {
      if (!this.destroyed) {
        // Restore the single-disc invariant even if a browser interrupts animation.
        this.tracks.forEach((track, index) => (index === this.current ? this.slot : track.well).append(track.disc));
        this.root.querySelectorAll('.vinyl-player__flight').forEach((flight) => flight.remove());
        this.createRotation();
        this.fail('The record is ready. Press play to continue.');
      }
    } finally {
      this.busy = false;
      if (!this.destroyed) { this.syncControls(); this.updateProgress(); }
    }
  }

  /** Scroll only the crate, never the page, so both transfer endpoints are real.
   * @param {number} index */
  reveal(index) {
    const button = this.buttons[index];
    const listRect = this.list.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    if (rect.top < listRect.top) this.list.scrollTop -= listRect.top - rect.top + 3;
    else if (rect.bottom > listRect.bottom) this.list.scrollTop += rect.bottom - listRect.bottom + 3;
  }

  /** Convert viewport measurements to the player's scroll-stable coordinate space.
   * @param {DOMRect} rect @param {number} size */
  position(rect, size) {
    const root = this.root.getBoundingClientRect();
    return { x: rect.left - root.left + (rect.width - size) / 2, y: rect.top - root.top + (rect.height - size) / 2, scale: rect.width / size };
  }

  /** @param {Element} disc @param {DOMRect} rect @param {number} size */
  flight(disc, rect, size) {
    const flight = document.createElement('div');
    flight.className = 'vinyl-player__flight';
    flight.setAttribute('aria-hidden', 'true');
    flight.style.width = `${size}px`;
    this.root.append(flight);
    flight.append(disc);
    gsap.set(flight, { ...this.position(rect, size), transformOrigin: '50% 50%', transformPerspective: 900 });
    return flight;
  }

  /** @param {number} target */
  async replace(target) {
    this.setPhase('preparing');
    this.setStatus('Lifting the needle. Changing records…');
    this.wantsPlayback = false;
    this.playAttempt += 1;
    this.playing = false;
    await Promise.all([this.fade(0, 0.35), this.spin(false)]);
    if (this.destroyed) return;
    this.audio.pause();
    await this.setArm(false);
    if (this.destroyed) return;

    const old = this.tracks[this.current];
    const next = this.tracks[target];
    this.rotation?.commitStyles();
    this.rotation?.cancel();
    this.rotation = null;

    if (this.reducedMotion.matches) {
      // No cross-screen motion or continuous rotation for reduced-motion users.
      old.well.append(old.disc);
      this.setPhase('empty');
      await this.tween({}, { duration: 0.12 });
      if (this.destroyed) return;
      this.slot.append(next.disc);
    } else {
      this.reveal(this.current);
      this.setPhase('removing');
      let platter = this.slot.getBoundingClientRect();
      let size = platter.width;
      const outgoing = this.flight(old.disc, platter, size);
      const start = this.position(platter, size);
      await this.tween(outgoing, { y: start.y - 24, rotationX: 14, rotation: -5, scale: 1.035, duration: 0.2, ease: 'power2.out' });
      if (this.destroyed) return;
      await this.tween(outgoing, { ...this.position(old.well.getBoundingClientRect(), size), rotationX: 0, rotation: 0, duration: 0.55, ease: 'power2.inOut' });
      if (this.destroyed) return;
      old.well.append(old.disc);
      outgoing.remove();
      this.setPhase('empty');
      await this.tween({}, { duration: 0.08 });
      if (this.destroyed) return;

      this.reveal(target);
      this.setPhase('retrieving');
      platter = this.slot.getBoundingClientRect();
      size = platter.width;
      const origin = next.well.getBoundingClientRect();
      const incoming = this.flight(next.disc, origin, size);
      const source = this.position(origin, size);
      const destination = this.position(platter, size);
      await this.tween(incoming, { y: source.y - 18, rotationX: 18, rotation: -12, scale: source.scale * 1.08, duration: 0.18, ease: 'power2.out' });
      if (this.destroyed) return;
      await this.tween(incoming, { ...destination, y: destination.y - 26, scale: 1.035, rotationX: 12, rotation: -3, duration: 0.65, ease: 'power2.inOut' });
      if (this.destroyed) return;
      this.setPhase('placing');
      // Re-measure at contact in case the viewport resized during the flight.
      await this.tween(incoming, { ...this.position(this.slot.getBoundingClientRect(), size), rotationX: 0, rotation: 0, duration: 0.28, ease: 'power2.out' });
      if (this.destroyed) return;
      this.slot.append(next.disc);
      incoming.remove();
      await this.tween(next.disc, { y: 1, duration: 0.06, repeat: 1, yoyo: true, ease: 'sine.inOut' });
    }
    if (this.destroyed) return;
    // Metadata changes only after the new physical record has made contact.
    this.current = target;
    this.loadTrack();
    this.createRotation();
    this.syncControls();
    if (this.requested === target && this.root.dataset.phase !== 'error') {
      this.setPhase('lowering');
      await this.setArm(true);
    }
  }

  syncControls() {
    this.playButton.disabled = this.busy;
    this.playButton.setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
    this.find('[data-play-icon]').toggleAttribute('hidden', this.playing);
    this.find('[data-pause-icon]').toggleAttribute('hidden', !this.playing);
    this.buttons.forEach((button, index) => {
      const selected = index === this.requested;
      const playing = index === this.current && this.playing;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('data-playing', String(playing));
      required(button, '[data-record-state]').textContent = playing ? 'Playing' : selected ? (this.busy ? 'Selected · changing' : 'Selected') : index === this.current ? 'On the platter' : 'Select record';
    });
    this.seek.disabled = this.busy || !Number.isFinite(this.audio.duration);
    this.syncShared();
  }

  updateProgress() {
    const { currentTime, duration } = this.audio;
    const valid = Number.isFinite(duration) && duration > 0;
    this.seek.disabled = this.busy || !valid;
    this.seek.max = valid ? String(duration) : '100';
    this.seek.value = String(currentTime || 0);
    this.seek.style.setProperty('--progress', `${valid ? currentTime / duration * 100 : 0}%`);
    this.seek.setAttribute('aria-valuetext', `${timeLabel(currentTime)} of ${timeLabel(duration)}`);
    this.find('[data-current-time]').textContent = timeLabel(currentTime);
    this.find('[data-duration]').textContent = timeLabel(duration);
  }

  destroy() {
    this.destroyed = true;
    this.playAttempt += 1;
    this.events.abort();
    this.motion.forEach((animation) => animation.kill());
    this.motion.clear();
    this.rotation?.cancel();
    this.root.querySelectorAll('.vinyl-player__flight').forEach((flight) => flight.remove());

    this.shared.attached = false;
    const interrupted = this.busy;

    if (interrupted && this.tracks[this.requested]) {
      // A page change interrupted the record swap: finish it audio-only so the
      // chosen song keeps playing and the platter matches when we come back.
      const target = this.tracks[this.requested];
      this.current = this.requested;
      this.shared.session = true;
      this.sources = target.sources.filter((source) => this.audio.canPlayType(source.type));
      this.sourceIndex = 0;
      this.playing = true;
      this.wantsPlayback = true;
      if (this.sources.length) {
        this.audio.preload = 'metadata';
        this.audio.src = assetManager.getPlaybackUrl(this.sources[0].src);
        this.audio.load();
      }
    }

    // Never pause here: the shared element keeps playing across route changes.
    this.envelope.gain = 1;
    this.audio.volume = this.shared.muted ? 0 : Number(this.volume.value);
    if (interrupted && this.wantsPlayback && this.audio.src) {
      this.audio.play().catch(() => {});
    }

    this.shared.playlist = this.playlist;
    this.shared.currentId = this.tracks[this.current]?.id ?? null;
    this.shared.playing = !this.audio.paused;
    this.shared.wantsPlayback = this.wantsPlayback;
    this.shared.volume = Number(this.volume.value);
    this.shared.muted = this.audio.muted;
    syncVinylState();
    syncVinylDock();
  }
}
