import {
  DEFAULT_ROTATION_INTERVAL,
  applyInitialActiveState,
  getDelayUntilNextRotation,
  getRotationIndex,
  syncFitFrame,
} from './rotation.js';

export default class ImageShuffle {
  constructor(root, { interval = DEFAULT_ROTATION_INTERVAL } = {}) {
    this.root = root;
    this.interval =
      Number(root.dataset.shuffleInterval) ||
      Number(interval) ||
      DEFAULT_ROTATION_INTERVAL;
    this.images = Array.from(root.querySelectorAll('[data-shuffle-image]'));
    this.timer = null;
    this.destroyed = false;

    if (!this.images.length) return;

    const initialImage = this.root.querySelector('[data-shuffle-initial]');
    const initialIndex = initialImage
      ? this.images.indexOf(initialImage)
      : -1;

    this.currentIndex =
      initialIndex >= 0
        ? initialIndex
        : getRotationIndex(this.images.length, this.interval);

    const activeIndex = this.images.findIndex((image) =>
      image.classList.contains('is-active'),
    );

    if (activeIndex >= 0) {
      // The synchronous initializer already committed an item (the eager hero
      // image when one is marked). Keep it: swapping to the current time slot
      // here would replace the paint that is already in flight.
      this.currentIndex = activeIndex;
      this.syncFrame(this.images[activeIndex]);
    } else {
      applyInitialActiveState(this.root, () => {
        this.setActive(this.currentIndex);
        this.syncFrame(this.images[this.currentIndex]);
      });
    }

    this.startTimer();
  }

  setActive(index) {
    this.currentIndex = index;

    this.images.forEach((image, imageIndex) => {
      image.classList.toggle('is-active', imageIndex === index);
    });
  }

  startTimer() {
    if (this.timer || this.images.length <= 1 || this.destroyed) return;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    // Hold the first rotation until the image that is actually on screen has
    // loaded and painted. On a throttled connection the scheduled slot can
    // advance while the eager image is still in flight; swapping then would
    // replace a visible image with an unloaded variant.
    const initial = this.images[this.currentIndex];
    const loaded =
      initial && initial.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            initial?.addEventListener('load', resolve, { once: true });
            initial?.addEventListener('error', resolve, { once: true });
          });
    const decoded =
      loaded.then(() =>
        initial?.decode ? initial.decode().catch(() => {}) : undefined,
      );

    decoded.then(() => {
      if (this.destroyed) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!this.destroyed) this.scheduleNext();
        });
      });
    });
  }

  scheduleNext() {
    if (this.destroyed) return;

    this.timer = window.setTimeout(() => {
      this.timer = null;
      if (this.destroyed) return;

      const nextIndex = getRotationIndex(this.images.length, this.interval);
      const next = this.images[nextIndex];

      // Only swap to a variant that is already available. The remaining
      // variants stay lazy/low priority; until one is ready the current image
      // remains visible instead of flashing an empty frame.
      if (
        nextIndex !== this.currentIndex &&
        next &&
        next.complete &&
        next.naturalWidth
      ) {
        this.setActive(nextIndex);
        this.syncFrameAfterDecode(next);
      }

      this.scheduleNext();
    }, getDelayUntilNextRotation(this.interval));
  }

  syncFrameAfterDecode(image) {
    if (!image) return;

    const ready = image.decode
      ? image.decode().catch(() => {})
      : Promise.resolve();

    ready.then(() => {
      if (!this.destroyed) this.syncFrame(image);
    });
  }

  syncFrame(image) {
    syncFitFrame(this.root, image);
  }

  destroy() {
    this.destroyed = true;

    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    this.root.classList.remove('is-initializing');
  }
}
