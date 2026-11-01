import CertificateLightbox from './CertificateLightbox';

export default class CertificateStack {
  constructor(root) {
    this.root = root;
    this.lightbox = new CertificateLightbox(root);
    this.tabs = Array.from(
      root.querySelectorAll('[data-certificate-tab]'),
    );
    this.plates = Array.from(
      root.querySelectorAll('[data-certificate-plate]'),
    );
    this.labels = Array.from(
      root.querySelectorAll('[data-certificate-label]'),
    );
    this.status = document.querySelector('[data-certificate-status]');
    this.jumps = Array.from(
      document.querySelectorAll('[data-certificate-jump]'),
    );
    this.active = 0;
    const page = root.closest('.certificate-page');
    this.sealMarks = Array.from(page?.querySelectorAll('[data-certificate-mark]') ?? []);
    this.sealNumber = page?.querySelector('[data-certificate-seal-number]');

    this.bind();
    this.select(0);
  }

  bind() {
    this.tabs.forEach((tab, index) => {
      tab.disabled = false;

      tab.addEventListener('click', () => {
        this.select(Number(tab.dataset.certificateTab));
      });

      tab.addEventListener('keydown', (event) => {
        const total = this.tabs.length;
        let next = null;

        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          next = (index + 1) % total;
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          next = (index - 1 + total) % total;
        } else if (event.key === 'Home') {
          next = 0;
        } else if (event.key === 'End') {
          next = total - 1;
        }

        if (next === null) return;

        event.preventDefault();
        this.select(next);
        this.tabs[next].focus();
      });
    });

    this.plates.forEach((plate) => {
      plate.addEventListener('click', () => {
        const index = Number(plate.dataset.certificatePlate);
        if (index !== this.active) {
          this.select(index);
          return;
        }

        const image = plate.querySelector('img');
        if (!image) return;

        const label = this.labels[this.active];
        this.lightbox.open(image, {
          title: label?.querySelector('h2')?.textContent?.trim() ?? '',
          returnFocus: this.tabs[this.active] ?? null,
        });
      });
    });

    this.jumps.forEach((jump) => {
      jump.addEventListener('click', (event) => {
        event.preventDefault();
        const index = Number(jump.dataset.certificateJump);

        this.select(index);

        const reducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;

        this.root.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });

        this.tabs[index]?.focus({ preventScroll: true });
      });
    });
  }

  select(index) {
    const total = this.plates.length;
    if (!total || Number.isNaN(index)) return;

    this.active = (index + total) % total;

    this.plates.forEach((plate, plateIndex) => {
      const depth = (plateIndex - this.active + total) % total;

      plate.style.setProperty('--depth', depth);
      plate.style.zIndex = String(100 - depth);
      plate.dataset.active =
        plateIndex === this.active ? 'true' : 'false';
    });

    this.tabs.forEach((tab, tabIndex) => {
      tab.setAttribute(
        'aria-pressed',
        tabIndex === this.active ? 'true' : 'false',
      );
    });

    this.labels.forEach((label, labelIndex) => {
      label.hidden = labelIndex !== this.active;
    });

    this.root.dataset.active = String(this.active);
    this.sealMarks.forEach((mark, markIndex) => {
      mark.dataset.active = String(markIndex === this.active);
    });
    if (this.sealNumber) {
      this.sealNumber.textContent = this.tabs[this.active]?.textContent.trim() ?? '';
    }

    if (this.status) {
      const label = this.labels[this.active];
      const title = label?.querySelector('h2')?.textContent?.trim() ?? '';
      this.status.textContent = `Showing certificate ${this.active + 1} of ${total}: ${title}`;
    }

    this.scrollTabIntoView(this.active);
  }

  scrollTabIntoView(index) {
    const tab = this.tabs[index];
    const row = tab?.parentElement;
    if (!tab || !row || row.scrollWidth <= row.clientWidth + 1) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const left = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;

    row.scrollTo({
      left: Math.max(0, left),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }

  destroy() {
    this.lightbox?.destroy();
    this.lightbox = null;
  }
}
