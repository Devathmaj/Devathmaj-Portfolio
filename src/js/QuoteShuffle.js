const DEFAULT_SHUFFLE_INTERVAL = 60 * 60 * 1000;
const STORAGE_KEY = 'active-quote-id';

export default class QuoteShuffle {
  constructor(root, { interval = DEFAULT_SHUFFLE_INTERVAL } = {}) {
    this.root = root;
    this.interval =
      Number(root.dataset.shuffleInterval) ||
      Number(interval) ||
      DEFAULT_SHUFFLE_INTERVAL;
    this.quotes = Array.from(root.querySelectorAll('[data-quote-id]'));
    this.timer = null;

    if (!this.quotes.length) return;

    this.currentIndex = this.getStartingIndex();
    this.setActive(this.currentIndex);

    if (this.quotes.length > 1) {
      this.timer = window.setInterval(
        () => this.showNextQuote(),
        this.interval
      );
    }
  }

  getStartingIndex() {
    try {
      const storedId = window.localStorage.getItem(STORAGE_KEY);
      const storedIndex = this.quotes.findIndex(
        (quote) => quote.dataset.quoteId === storedId
      );

      if (storedIndex !== -1) return storedIndex;
    } catch (error) {
      console.error('Failed to read the active quote:', error);
    }

    return Math.floor(Math.random() * this.quotes.length);
  }

  showNextQuote() {
    this.currentIndex = (this.currentIndex + 1) % this.quotes.length;
    this.setActive(this.currentIndex);
  }

  setActive(index) {
    this.quotes.forEach((quote, quoteIndex) => {
      const isActive = quoteIndex === index;
      quote.classList.toggle('is-active', isActive);
      quote.setAttribute('aria-hidden', String(!isActive));
    });

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        this.quotes[index].dataset.quoteId
      );
    } catch (error) {
      console.error('Failed to store the active quote:', error);
    }
  }

  destroy() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}
