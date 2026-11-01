const DEFAULT_SHUFFLE_INTERVAL = 5000;

export default class ImageShuffle {
  constructor(root, { interval = DEFAULT_SHUFFLE_INTERVAL } = {}) {
    this.root = root;
    this.interval =
      Number(root.dataset.shuffleInterval) ||
      Number(interval) ||
      DEFAULT_SHUFFLE_INTERVAL;
    this.images = Array.from(root.querySelectorAll('[data-shuffle-image]'));
    this.currentIndex = Math.max(
      0,
      this.images.findIndex((image) => image.classList.contains('is-active'))
    );
    this.timer = null;
    this.destroyed = false;

    if (!this.images.length) return;

    this.images.forEach((image, index) => {
      image.classList.toggle('is-active', index === this.currentIndex);
    });

    this.syncFrame(this.images[this.currentIndex]);

    const activeImage = this.images[this.currentIndex];
    const activeReady =
      activeImage && activeImage.decode
        ? activeImage.decode().catch(() => {})
        : Promise.resolve();

    activeReady.then(() => {
      if (this.destroyed) return;
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      this.syncFrame(this.images[this.currentIndex]);
      if (this.images.length > 1 && !prefersReducedMotion) {
        this.timer = window.setInterval(
          () => this.showNextImage(),
          this.interval
        );
      }
    });
  }


  showNextImage() {
    this.images[this.currentIndex].classList.remove('is-active');
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    const nextImage = this.images[this.currentIndex];
    nextImage.classList.add('is-active');

    const ready = nextImage.decode
      ? nextImage.decode().catch(() => {})
      : Promise.resolve();

    ready.then(() => {
      if (!this.destroyed) this.syncFrame(nextImage);
    });
  }

  syncFrame(image) {
    if (!image || !this.root.hasAttribute('data-shuffle-fit')) return;

    const { naturalWidth, naturalHeight } = image;
    if (!naturalWidth || !naturalHeight) return;

    const frame = this.root.parentElement || this.root;
    frame.style.setProperty(
      '--letter-ratio',
      (naturalWidth / naturalHeight).toFixed(4)
    );
  }

  destroy() {
    this.destroyed = true;
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}

