/**
 * Small scheduling helpers for work that must never compete with the page the
 * visitor is looking at. `scheduler.postTask()` is used when the browser
 * supports it; otherwise the same work falls back to idle time or a short
 * timer so behaviour stays correct everywhere.
 */

const canPostTask = () =>
  typeof globalThis.scheduler?.postTask === 'function';

const fallback = (callback, timeout) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout });
  }
  return window.setTimeout(callback, Math.min(16, timeout));
};

/** Run work at background priority, after the current interaction settles. */
export function postBackgroundTask(callback, { delay = 0, timeout = 1000 } = {}) {
  if (canPostTask()) {
    try {
      return globalThis.scheduler.postTask(callback, {
        priority: 'background',
        delay,
      });
    } catch {
      // Fall through to the portable path.
    }
  }
  if (delay > 0 && typeof window !== 'undefined') {
    return window.setTimeout(callback, delay);
  }
  return fallback(callback, timeout);
}

/** Run work as soon as possible without blocking the current task. */
export function postUserTask(callback) {
  if (canPostTask()) {
    try {
      return globalThis.scheduler.postTask(callback, {
        priority: 'user-visible',
      });
    } catch {
      // Fall through to the portable path.
    }
  }
  return Promise.resolve().then(callback);
}

/** Resolve once the browser has a quiet moment. */
export function whenIdle(callback, timeout = 1500) {
  return fallback(callback, timeout);
}
