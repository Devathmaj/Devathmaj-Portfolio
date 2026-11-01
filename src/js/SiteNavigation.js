import gsap from 'gsap';
import { HIDDEN_ROUTES } from './DiscoveryStore.js';

const pointOnCircle = (radius, angle) => {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 160 + radius * Math.cos(radians),
    y: 160 + radius * Math.sin(radians),
  };
};

const normalizedPath = (path) => path.replace(/\/$/, '') || '/';

export default class SiteNavigation {
  constructor(root, discovery) {
    this.root = root;
    this.toggle = root.querySelector('.page-nav__orbit-toggle');
    this.menu = root.querySelector('.page-nav__orbit-menu');
    this.closeButton = root.querySelector('.page-nav__orbit-close');
    this.chart = root.querySelector('.page-nav__orbit-chart');
    this.homeLink = root.querySelector('.page-nav__orbit-center');
    this.links = [...root.querySelectorAll('.page-nav__orbit-link')];
    this.baseLinks = [...this.links];
    this.linkContainer = root.querySelector('.page-nav__orbit-links');
    this.discoveryLinks = new Map();
    this.segments = [];
    this.currentIndex = -1;
    this.hoveredIndex = null;
    this.focusedIndex = null;
    this.abortController = new AbortController();
    this.previousOverflow = null;
    this.inertedElements = [];

    document.body.append(this.menu);

    this.weights = [];
    this.unsubscribe = discovery.subscribe(() => this.syncDiscoveries(discovery));
    this.bindEvents();
    this.syncCurrentPage();
  }

  syncDiscoveries(discovery) {
    const previousLinks = this.links;
    const previousWeights = this.weights;
    HIDDEN_ROUTES.forEach((route) => {
      if (discovery.isDiscovered(route.id) && !this.discoveryLinks.has(route.id)) {
        const link = document.createElement('a');
        link.className = 'page-nav__orbit-link';
        link.href = route.path;
        link.textContent = route.label;
        this.linkContainer.append(link);
        this.discoveryLinks.set(route.id, link);
      } else if (!discovery.isDiscovered(route.id)) {
        this.discoveryLinks.get(route.id)?.remove();
        this.discoveryLinks.delete(route.id);
      }
    });
    // Keep discovery order stable so an existing partition never swaps places.
    this.links = [...this.baseLinks, ...this.discoveryLinks.values()];
    if (this.weights.length && this.links.length === previousLinks.length &&
        this.links.every((link, index) => link === previousLinks[index])) return;
    this.geometryTween?.kill();

    const previousSegments = this.segments;
    const namespace = 'http://www.w3.org/2000/svg';
    this.segments = this.links.map((link, index) => {
      const path = previousSegments[previousLinks.indexOf(link)] || document.createElementNS(namespace, 'path');
      path.setAttribute('class', 'page-nav__orbit-segment');
      path.dataset.index = index;
      link.dataset.index = index;
      this.chart.append(path);
      return path;
    });
    previousSegments.filter((segment) => !this.segments.includes(segment)).forEach((segment) => segment.remove());
    this.hoveredIndex = null;
    this.focusedIndex = null;

    const animate = previousWeights.length && this.links.length > previousLinks.length &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = this.links.map((link) => previousWeights[previousLinks.indexOf(link)] ?? 0);
    const target = 1 / this.links.length;
    const frame = { progress: animate ? 0 : 1 };
    const draw = () => {
      this.weights = start.map((weight) => weight + (target - weight) * frame.progress);
      this.drawChart();
      this.links.forEach((link, index) => {
        const opacity = start[index] === 0 ? frame.progress : 1;
        link.style.opacity = opacity;
        // Keep the solid ring throughout redistribution; fade only the new label.
      });
    };
    draw();
    if (animate) this.geometryTween = gsap.to(frame, {
      progress: 1, duration: 0.4, ease: 'power2.inOut', onUpdate: draw,
    });
    this.syncCurrentPage();
  }

  drawChart() {
    // Adjacent paths share the very same boundary on every animation frame.
    let startAngle = -90 - this.weights[0] * 180;
    this.segments.forEach((segment, index) => {
      const angle = this.weights[index] * 360;
      const endAngle = startAngle + angle;
      const outerStart = pointOnCircle(148, startAngle);
      const outerEnd = pointOnCircle(148, endAngle);
      const innerEnd = pointOnCircle(82, endAngle);
      const innerStart = pointOnCircle(82, startAngle);
      const largeArc = angle > 180 ? 1 : 0;
      segment.setAttribute('d',
        `M ${outerStart.x} ${outerStart.y} A 148 148 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A 82 82 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`);
      const point = pointOnCircle(112, startAngle + angle / 2);
      const link = this.links[index];
      link.style.setProperty('--orbit-x', `${(point.x / 320) * 100}%`);
      link.style.setProperty('--orbit-y', `${(point.y / 320) * 100}%`);
      startAngle = endAngle;
    });
  }

  bindEvents() {
    const { signal } = this.abortController;
    this.toggle.addEventListener('click', () => {
      this.setOpen(this.toggle.getAttribute('aria-expanded') !== 'true');
    }, { signal });
    this.closeButton.addEventListener('click', () => this.setOpen(false), { signal });
    this.menu.addEventListener('pointerdown', (event) => {
      if (event.target === this.menu) this.setOpen(false);
    }, { signal });

    // Delegation also covers partitions added after initialization.
    ['pointerover', 'pointerout', 'focusin', 'focusout'].forEach((type) => {
      this.menu.addEventListener(type, (event) => {
        const item = event.target.closest('[data-index]');
        if (!item) return;
        const key = type.startsWith('pointer') ? 'hoveredIndex' : 'focusedIndex';
        this[key] = type.endsWith('out') ? null : Number(item.dataset.index);
        this.updateHighlight();
      }, { signal });
    });
    this.menu.addEventListener('click', (event) => {
      const segment = event.target.closest('.page-nav__orbit-segment');
      if (segment) this.links[Number(segment.dataset.index)].click();
      if (event.target.closest('.page-nav__orbit-link, .page-nav__orbit-center')) {
        this.setOpen(false);
      }
    }, { signal });

    document.addEventListener('keydown', (event) => {
      if (this.toggle.getAttribute('aria-expanded') !== 'true') return;

      if (event.key === 'Escape') {
        this.setOpen(false);
        return;
      }

      if (event.key === 'Tab') {
        const focusable = [...this.menu.querySelectorAll('button:not([disabled]), a[href]')];
        const first = focusable[0];
        const last = focusable.at(-1);

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }, { signal });
  }

  setOpen(open) {
    const wasOpen = this.toggle.getAttribute('aria-expanded') === 'true';
    if (wasOpen === open) return;

    this.toggle.setAttribute('aria-expanded', String(open));
    this.toggle.setAttribute(
      'aria-label',
      `${open ? 'Close' : 'Open'} site navigation`,
    );
    this.menu.hidden = !open;

    if (open) {
      this.returnFocus = this.toggle;
      this.previousOverflow = {
        body: document.body.style.overflow,
        html: document.documentElement.style.overflow,
      };
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      this.inertedElements = [...document.body.children]
        .filter((element) => element !== this.menu)
        .map((element) => ({ element, wasInert: element.inert }));
      this.inertedElements.forEach(({ element }) => {
        element.inert = true;
      });
      (this.currentIndex >= 0 ? this.links[this.currentIndex] : this.closeButton).focus();
    } else {
      document.body.style.overflow = this.previousOverflow?.body ?? '';
      document.documentElement.style.overflow = this.previousOverflow?.html ?? '';
      this.inertedElements.forEach(({ element, wasInert }) => {
        element.inert = wasInert;
      });
      this.inertedElements = [];
      this.previousOverflow = null;
      (this.returnFocus?.isConnected ? this.returnFocus : this.toggle).focus();
    }
  }

  highlight(index) {
    this.links.forEach((link, linkIndex) => {
      const isHighlighted = linkIndex === index;
      link.classList.toggle('is-highlighted', isHighlighted);
      this.segments[linkIndex].classList.toggle('is-highlighted', isHighlighted);
    });
  }

  updateHighlight() {
    const selectedIndex = this.hoveredIndex ?? this.focusedIndex ?? this.currentIndex;
    this.highlight(selectedIndex);
  }

  syncCurrentPage() {
    const currentPath = normalizedPath(window.location.pathname);
    let currentIndex = -1;
    if (currentPath === '/') this.homeLink.setAttribute('aria-current', 'page');
    else this.homeLink.removeAttribute('aria-current');

    this.links.forEach((link, index) => {
      const linkPath = normalizedPath(new URL(link.href).pathname);
      const isCurrent =
        linkPath === currentPath ||
        (linkPath !== '/' && currentPath.startsWith(`${linkPath}/`));
      if (isCurrent) currentIndex = index;
      link.classList.toggle('is-current', isCurrent);
      this.segments[index].classList.toggle('is-current', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    this.currentIndex = currentIndex;
    this.updateHighlight();
  }

  destroy() {
    this.setOpen(false);
    this.unsubscribe?.();
    this.geometryTween?.kill();
    this.abortController.abort();
    this.menu.remove();
  }
}
