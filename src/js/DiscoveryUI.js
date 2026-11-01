import { HIDDEN_ROUTES } from './DiscoveryStore.js';

const DISCOVERY_ORIGIN = 'https://devathmaj.me';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const HIDDEN_PAGE_TOTAL = HIDDEN_ROUTES.length;

const PROGRESS_COPY = [
  {
    title: 'Two hidden pages',
    description: 'There are two hidden pages tucked away on this website. Think you can find them both?',
    support: 'Two pages still hidden.',
  },
  {
    title: 'Well spotted!',
    description: "Well spotted! You've uncovered one of the hidden pages (1/2). One more to go!",
    support: 'One more secret remains.',
  },
  {
    title: 'Case closed',
    description: "You found them both! Nicely done, detective. You've uncovered all the hidden pages. Guess there are no more secrets left to find... or are there?",
    support: 'Achievement completed.',
  },
];

export default class DiscoveryUI {
  constructor(store) {
    this.store = store;
    this.dialog = document.querySelector('[data-discovery-notice]');
    this.trigger = document.querySelector('[data-discovery-trigger]');
    this.notice = null;
    this.mode = 'notice';
    this.trigger?.addEventListener('click', () => this.openProgress());
    this.dialog.querySelector('button').addEventListener('click', () => this.dismiss());
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.dialog.showModal) this.dismiss(true);
      if (event.key !== 'Tab') return;
      // Keep keyboard focus inside the dialog, including the discovered links.
      const focusable = [...this.dialog.querySelectorAll('a[href], button:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.dismiss(true);
    });
    this.dialog.addEventListener('click', (event) => {
      if (event.target !== this.dialog) return;
      const rect = this.dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) this.dismiss();
    });
    store.subscribe(() => this.refresh());
  }

  refresh() {
    const count = this.store.discoveredCount;
    const complete = count === HIDDEN_PAGE_TOTAL;
    document.querySelectorAll('[data-discovery-announcement]').forEach((element) => {
      element.textContent = complete
        ? 'Congratulations! You found all the hidden routes.'
        : `Hidden Routes Unlocked ${count}/2`;
    });
    document.querySelectorAll('[data-discovery-progress]').forEach((element) => {
      element.classList.toggle('is-complete', complete);
      element.querySelector('[data-discovery-title]').textContent = complete
        ? 'Congratulations!'
        : 'Hidden routes';
      element.querySelector('[data-discovery-message]').textContent = complete
        ? 'All hidden routes found'
        : 'Find both secret paths';
      element.querySelector('[data-discovery-count]').textContent = `${count}/2`;
      element.querySelectorAll('[data-discovery-step]').forEach((step) => {
        step.classList.toggle('is-unlocked', Number(step.dataset.discoveryStep) <= count);
      });
    });
    document.querySelectorAll('template[data-discovery-template]').forEach((template) => {
      const id = template.dataset.discoveryTemplate;
      const existing = template.parentElement.querySelector(`[data-discovery-content="${id}"]`);
      if (this.store.isDiscovered(id) && !existing) {
        template.before(template.content.cloneNode(true));
      } else if (!this.store.isDiscovered(id)) {
        existing?.remove();
      }
    });
    if (this.mode === 'manual' && this.dialog.open) this.renderProgress();
    this.showNotice();
  }

  openProgress() {
    this.mode = 'manual';
    this.renderProgress();
    this.openDialog();
  }

  renderProgress() {
    const count = this.store.discoveredCount;
    const copy = PROGRESS_COPY[count] ?? PROGRESS_COPY[0];
    this.dialog.querySelector('[data-discovery-title]').textContent = copy.title;
    this.dialog.querySelector('[data-discovery-description]').textContent = copy.description;
    this.dialog.querySelector('[data-discovery-count]').textContent = `${count} / 2`;
    this.dialog.querySelector('[data-discovery-support]').textContent = copy.support;
    this.renderDiscoveries(count);
    this.setProgress(count);
  }

  renderDiscoveries(count) {
    const container = this.dialog.querySelector('[data-discovery-discoveries]');
    const label = container.querySelector('[data-discovery-discoveries-label]');
    const list = container.querySelector('[data-discovery-discoveries-list]');
    container.hidden = count === 0;
    container.classList.toggle('is-single', count === 1);
    if (!count) {
      label.textContent = '';
      list.replaceChildren();
      return;
    }
    label.textContent = count === 2 ? 'Your discoveries:' : 'Found:';
    const originLabel = DISCOVERY_ORIGIN.replace(/^https?:\/\//, '');
    list.replaceChildren(...this.store.discoveredRoutes.map((id) => {
      const route = HIDDEN_ROUTES.find((item) => item.id === id);
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `${DISCOVERY_ORIGIN}${route.path}`;
      link.textContent = `${originLabel}${route.path.replace(/\/$/, '')}`;
      item.append(link);
      return item;
    }));
  }

  setProgress(count, from = count) {
    const progress = this.dialog.querySelector('[role="progressbar"]');
    progress.setAttribute('aria-valuenow', count);
    const fill = progress.firstElementChild;
    fill.style.transform = `scaleX(${count / HIDDEN_PAGE_TOTAL})`;
    if (count === from || window.matchMedia(REDUCED_MOTION).matches) return;
    fill.animate?.([
      { transform: `scaleX(${from / HIDDEN_PAGE_TOTAL})` },
      { transform: `scaleX(${count / HIDDEN_PAGE_TOTAL})` },
    ], { duration: 400, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }

  showNotice() {
    const notice = this.store.discoveryNotice;
    if (notice === this.notice) return;
    this.notice = notice;
    if (!notice) {
      this.closeDialog();
      return;
    }
    this.mode = 'notice';
    const complete = notice.count === HIDDEN_PAGE_TOTAL;
    this.dialog.querySelector('[data-discovery-title]').textContent = complete
      ? 'Congratulations!' : 'Well, well, well.';
    this.dialog.querySelector('[data-discovery-description]').textContent = complete
      ? "You've found all the hidden routes."
      : "You've found something that wasn't supposed to be visible.";
    this.dialog.querySelector('[data-discovery-count]').textContent = `${notice.count} / 2`;
    this.dialog.querySelector('[data-discovery-support]').textContent = complete
      ? 'Achievement completed.' : 'One more secret remains.';
    this.renderDiscoveries(notice.count);
    this.setProgress(notice.count, notice.count - 1);
    this.openDialog();
  }

  openDialog() {
    if (!this.dialog.open) {
      this.returnFocus = document.activeElement;
      if (this.dialog.showModal) this.dialog.showModal();
      else this.dialog.setAttribute('open', '');
      this.dialog.querySelector('button').focus({ preventScroll: true });
    }
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    this.dialog.animate?.([
      { opacity: 0, transform: 'translateY(8px) scale(0.98)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }

  closeDialog() {
    this.dialog.close?.();
    this.dialog.removeAttribute('open');
  }

  dismiss(immediate = false) {
    if (this.closing) return;
    const finish = () => {
      this.closing = false;
      if (this.store.discoveryNotice) {
        this.store.dismissDiscoveryNotice();
      } else {
        this.closeDialog();
      }
      if (!this.store.discoveryNotice && this.returnFocus?.isConnected) {
        this.returnFocus.focus({ preventScroll: true });
      }
    };
    if (immediate || !this.dialog.animate ||
        window.matchMedia(REDUCED_MOTION).matches) return finish();
    this.closing = true;
    const animation = this.dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140 });
    // Dismissal never depends on a successful animation callback.
    const timer = window.setTimeout(finish, 180);
    animation.finished.then(() => {
      window.clearTimeout(timer);
      finish();
    }, () => {});
  }
}
