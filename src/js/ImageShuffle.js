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

    this.currentIndex = getRotationIndex(
      this.images.length,
      this.interval,
    );

    const hasActiveImage = this.images.some((image) =>
      image.classList.contains('is-active'),
    );

    if (hasActiveImage) {
      // The synchronous initializer already picked the scheduled item. Only
      // update it if the time slot advanced while the module was loading.
      this.setActive(this.currentIndex);
      this.syncFrame(this.images[this.currentIndex]);
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

    const scheduleNext = () => {
      if (this.destroyed) return;

      this.timer = window.setTimeout(() => {
        this.timer = null;
        if (this.destroyed) return;

        const nextIndex = getRotationIndex(
          this.images.length,
          this.interval,
        );

        if (nextIndex !== this.currentIndex) {
          this.setActive(nextIndex);
          this.syncFrameAfterDecode(this.images[nextIndex]);
        }

        scheduleNext();
      }, getDelayUntilNextRotation(this.interval));
    };

    scheduleNext();
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
