import {
  DEFAULT_ROTATION_INTERVAL,
  applyInitialActiveState,
  getDelayUntilNextRotation,
  getRotationIndex,
} from './rotation.js';

export default class QuoteShuffle {
  constructor(root, { interval = DEFAULT_ROTATION_INTERVAL } = {}) {
    this.root = root;
    this.interval =
      Number(root.dataset.shuffleInterval) ||
      Number(interval) ||
      DEFAULT_ROTATION_INTERVAL;
    this.quotes = Array.from(root.querySelectorAll('[data-quote-id]'));
    this.timer = null;
    this.destroyed = false;

    if (!this.quotes.length) return;

    this.currentIndex = getRotationIndex(
      this.quotes.length,
      this.interval,
    );

    const hasActiveQuote = this.quotes.some((quote) =>
      quote.classList.contains('is-active'),
    );

    if (hasActiveQuote) {
      // The synchronous initializer already picked the scheduled item. Only
      // update it if the time slot advanced while the module was loading.
      this.setActive(this.currentIndex);
    } else {
      applyInitialActiveState(this.root, () =>
        this.setActive(this.currentIndex),
      );
    }

    this.startTimer();
  }

  setActive(index) {
    this.currentIndex = index;

    this.quotes.forEach((quote, quoteIndex) => {
      const isActive = quoteIndex === index;
      quote.classList.toggle('is-active', isActive);
      quote.setAttribute('aria-hidden', String(!isActive));
    });
  }

  startTimer() {
    if (this.timer || this.quotes.length <= 1 || this.destroyed) return;

    const scheduleNext = () => {
      if (this.destroyed) return;

      this.timer = window.setTimeout(() => {
        this.timer = null;
        if (this.destroyed) return;

        const nextIndex = getRotationIndex(
          this.quotes.length,
          this.interval,
        );

        if (nextIndex !== this.currentIndex) {
          this.setActive(nextIndex);
        }

        scheduleNext();
      }, getDelayUntilNextRotation(this.interval));
    };

    scheduleNext();
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
