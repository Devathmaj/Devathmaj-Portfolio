const DEFAULT_SHUFFLE_INTERVAL = 60 * 60 * 1000;
const STORAGE_KEY_PREFIX = 'active-image-src';

export default class ImageShuffle {
  constructor(root, { interval = DEFAULT_SHUFFLE_INTERVAL } = {}) {
    this.root = root;
    this.interval =
      Number(root.dataset.shuffleInterval) ||
      Number(interval) ||
      DEFAULT_SHUFFLE_INTERVAL;
    this.images = Array.from(root.querySelectorAll('[data-shuffle-image]'));
    this.storageKey = `${STORAGE_KEY_PREFIX}:${this.getStorageKeySuffix()}`;
    this.timer = null;
    this.destroyed = false;

    if (!this.images.length) return;

    this.currentIndex = this.getStartingIndex();

    this.images.forEach((image, index) => {
      image.classList.toggle('is-active', index === this.currentIndex);
    });

    this.persistActive();
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

  getStorageKeySuffix() {
    if (this.root.dataset.shuffleKey) return this.root.dataset.shuffleKey;

    const firstImage = this.images[0];
    return firstImage?.getAttribute('src') || 'default';
  }

  getStartingIndex() {
    try {
      const storedSrc = window.localStorage.getItem(this.storageKey);
      if (storedSrc) {
        const storedIndex = this.images.findIndex(
          (image) => image.getAttribute('src') === storedSrc
        );
        if (storedIndex !== -1) return storedIndex;
      }
    } catch (error) {
      console.error('Failed to read the active image:', error);
    }

    return Math.floor(Math.random() * this.images.length);
  }

  persistActive() {
    try {
      window.localStorage.setItem(
        this.storageKey,
        this.images[this.currentIndex].getAttribute('src')
      );
    } catch (error) {
      console.error('Failed to store the active image:', error);
    }
  }

  showNextImage() {
    this.images[this.currentIndex].classList.remove('is-active');
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    const nextImage = this.images[this.currentIndex];
    nextImage.classList.add('is-active');
    this.persistActive();

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

