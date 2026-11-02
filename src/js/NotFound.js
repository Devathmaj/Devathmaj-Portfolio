/**
 * The 404 document is served statically for every missing route, so the
 * address that was actually requested only exists in the browser.
 */
export default function initNotFound() {
  const target = document.querySelector('[data-not-found-path]');
  if (!target) return;

  const { pathname, search, hash } = window.location;
  const requested = `${pathname}${search}${hash}` || '/';

  target.textContent = requested;
  target.setAttribute('title', requested);
}
