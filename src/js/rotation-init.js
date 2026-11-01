import {
  DEFAULT_ROTATION_INTERVAL,
  applyInitialActiveState,
  getRotationIndex,
  syncFitFrame,
} from './rotation.js';

const READY_ATTRIBUTE = 'data-rotation-ready';

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

/**
 * The homepage includes this file three times so each shuffle can start as
 * soon as its markup is parsed. Only unmarked roots are processed, which keeps
 * the later executions from repeating layout work for the same elements.
 */
const initializeRotations = () => {
  document
    .querySelectorAll(`[data-quote-stack]:not([${READY_ATTRIBUTE}])`)
    .forEach((root) => {
      root.dataset.rotationReady = '';
      initializeQuote(root);
    });
  document
    .querySelectorAll(`[data-image-shuffle]:not([${READY_ATTRIBUTE}])`)
    .forEach((root) => {
      root.dataset.rotationReady = '';
      initializeImages(root);
    });
};

initializeRotations();
// Catch roots inserted after this script runs (for example WebC rendering or
// a router navigation) without rescanning them again.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRotations, { once: true });
}
