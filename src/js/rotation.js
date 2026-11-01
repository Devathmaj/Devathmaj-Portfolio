export const DEFAULT_ROTATION_INTERVAL = 60 * 60 * 1000;

const normalizeInterval = (interval) => {
  const value = Number(interval);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_ROTATION_INTERVAL;
};

/**
 * Resolve the item for a given time slot. The slot is derived from the Unix
 * epoch, so every page load (and every component instance) agrees on the same
 * item for the same moment in time.
 */
export const getRotationIndex = (length, interval, now = Date.now()) => {
  if (!Number.isFinite(length) || length <= 0) return 0;

  const slotInterval = normalizeInterval(interval);
  const slot = Math.floor(now / slotInterval);

  return ((slot % length) + length) % length;
};

/**
 * Milliseconds remaining until the next slot boundary. This keeps the timer
 * aligned to the clock instead of drifting from an arbitrary page-load time.
 */
export const getDelayUntilNextRotation = (
  interval,
  now = Date.now(),
) => {
  const slotInterval = normalizeInterval(interval);
  const elapsed = now % slotInterval;

  return elapsed === 0 ? slotInterval : slotInterval - elapsed;
};

/**
 * Apply the initial active item with transitions disabled. Forcing a style
 * flush commits the correct item before transitions are re-enabled, so
 * restoring the scheduled item never looks like a rotation animation.
 */
export const applyInitialActiveState = (root, apply) => {
  root.classList.add('is-initializing');

  try {
    apply();
  } finally {
    // Commit the active state while transitions are suppressed.
    void root.offsetWidth;
    root.classList.remove('is-initializing');
  }
};

/**
 * Keep the letterbox frame in sync with the active image's intrinsic ratio.
 * The width/height attributes are available before the image finishes
 * decoding, which avoids a layout shift during initialization.
 */
export const syncFitFrame = (root, image) => {
  if (!root.hasAttribute('data-shuffle-fit') || !image) return;

  const width =
    image.naturalWidth || Number(image.getAttribute('width'));
  const height =
    image.naturalHeight || Number(image.getAttribute('height'));

  if (!width || !height) return;

  const frame = root.parentElement || root;
  frame.style.setProperty('--letter-ratio', (width / height).toFixed(4));
};
