import {
  DEFAULT_ROTATION_INTERVAL,
  applyInitialActiveState,
  getRotationIndex,
  syncFitFrame,
} from './rotation.js';

const getInterval = (root) =>
  Number(root.dataset.shuffleInterval) || DEFAULT_ROTATION_INTERVAL;

const initializeQuote = (root) => {
  if (root.querySelector('.callout__quote.is-active')) return;

  const quotes = Array.from(root.querySelectorAll('[data-quote-id]'));
  if (!quotes.length) return;

  const index = getRotationIndex(quotes.length, getInterval(root));

  applyInitialActiveState(root, () => {
    quotes.forEach((quote, quoteIndex) => {
      const isActive = quoteIndex === index;
      quote.classList.toggle('is-active', isActive);
      quote.setAttribute('aria-hidden', String(!isActive));
    });
  });
};

const initializeImages = (root) => {
  if (root.querySelector('[data-shuffle-image].is-active')) return;

  const images = Array.from(root.querySelectorAll('[data-shuffle-image]'));
  if (!images.length) return;

  const index = getRotationIndex(images.length, getInterval(root));

  applyInitialActiveState(root, () => {
    images.forEach((image, imageIndex) => {
      image.classList.toggle('is-active', imageIndex === index);
    });
    syncFitFrame(root, images[index]);
  });
};

const initializeRotations = () => {
  document
    .querySelectorAll('[data-quote-stack]')
    .forEach(initializeQuote);
  document
    .querySelectorAll('[data-image-shuffle]')
    .forEach(initializeImages);
};

initializeRotations();
