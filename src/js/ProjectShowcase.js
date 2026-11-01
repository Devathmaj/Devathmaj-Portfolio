const pad = (value) => String(value).padStart(2, '0');

export default class ProjectShowcase {
  constructor(root) {
    this.root = root;
    this.stage = root.querySelector('[data-project-stage]');
    this.links = Array.from(root.querySelectorAll('[data-chapter-link]'));
    this.sideLinks = Array.from(root.querySelectorAll('[data-project-side-link]'));
    this.positionEl = root.querySelector('[data-chapter-position]');
    this.announceEl = root.querySelector('[data-chapter-announce]');
    this.prevButton = root.querySelector('[data-chapter-prev]');
    this.nextButton = root.querySelector('[data-chapter-next]');
    this.prevTitleEl = root.querySelector('[data-chapter-prev-title]');
    this.nextTitleEl = root.querySelector('[data-chapter-next-title]');
    this.sideIndexEl = root.querySelector('[data-project-side-index]');
    this.sideTitleEl = root.querySelector('[data-project-side-title]');
    this.sideSteps = Array.from(root.querySelectorAll('[data-project-side-step]'));
    this.chapters = [];
    this.activeId = null;

    this.handleClick = this.handleClick.bind(this);
    this.handleHashChange = this.handleHashChange.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handlePrev = this.handlePrev.bind(this);
    this.handleNext = this.handleNext.bind(this);

    if (!this.stage || !this.links.length) return;

    this.buildChapters();
    if (!this.chapters.length) return;

    this.links.forEach((link) => {
      link.addEventListener('click', this.handleClick);
    });
    this.sideLinks.forEach((link) => {
      link.addEventListener('click', this.handleClick);
    });
    this.prevButton?.addEventListener('click', this.handlePrev);
    this.nextButton?.addEventListener('click', this.handleNext);
    this.root.addEventListener('keydown', this.handleKeydown);
    window.addEventListener('hashchange', this.handleHashChange);

    this.root.classList.add('project-showproject--enhanced');

    this.resetHashOnReload();

    const hashId = this.getHashId();
    const initialId =
      hashId && this.hasChapter(hashId) ? hashId : this.chapters[0].id;

    this.activate(initialId, {
      updateHash: false,
      scroll: Boolean(hashId),
      smooth: false,
    });
  }

  buildChapters() {
    const children = Array.from(this.stage.children);
    let current = null;
    let leading = [];

    children.forEach((child) => {
      if (child.tagName === 'H2' && child.id) {
        current = {
          id: child.id,
          heading: child,
          title: child.textContent.trim(),
          elements: [child],
        };

        if (!this.chapters.length && leading.length) {
          current.elements.unshift(...leading);
        }

        this.chapters.push(current);
        leading = [];
      } else if (current) {
        current.elements.push(child);
      } else {
        leading.push(child);
      }
    });

  }

  hasChapter(id) {
    return this.chapters.some((chapter) => chapter.id === id);
  }

  getHashId() {
    const hash = window.location.hash.replace(/^#/, '');
    return hash ? decodeURIComponent(hash) : null;
  }

  resetHashOnReload() {
    const navigationEntry = performance.getEntriesByType('navigation')[0];
    const isReload =
      navigationEntry?.type === 'reload' || performance.navigation?.type === 1;

    if (isReload && window.location.hash) {
      window.history.replaceState(
        null,
        document.title,
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }

  handleClick(event) {
    const link = event.currentTarget;
    const id = link.dataset.chapterLink || link.dataset.projectSideLink;

    if (!id || !this.hasChapter(id)) return;

    event.preventDefault();
    this.activate(id, {
      updateHash: true,
      scroll: true,
      scrollTarget: link.dataset.projectSideLink ? 'chapter' : 'root',
    });
  }

  handleHashChange() {
    const id = this.getHashId();

    if (id && this.hasChapter(id)) {
      this.activate(id, { updateHash: false, scroll: true });
    }
  }

  handleKeydown(event) {
    const currentIndex = this.links.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % this.links.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex =
          (currentIndex - 1 + this.links.length) % this.links.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = this.links.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.links[nextIndex].focus();
  }

  handlePrev() {
    this.step(-1, 'chapter');
  }

  handleNext() {
    this.step(1, 'chapter');
  }

  step(direction, scrollTarget = 'root') {
    const currentIndex = this.chapters.findIndex(
      (chapter) => chapter.id === this.activeId,
    );

    if (currentIndex === -1) return;

    const nextIndex =
      (currentIndex + direction + this.chapters.length) % this.chapters.length;

    this.activate(this.chapters[nextIndex].id, {
      updateHash: true,
      scroll: true,
      scrollTarget,
    });
  }

  activate(
    id,
    {
      updateHash = false,
      scroll = false,
      smooth = true,
      scrollTarget = 'root',
    } = {},
  ) {
    const chapter = this.chapters.find((entry) => entry.id === id);
    if (!chapter) return;

    if (id === this.activeId) {
      if (scroll) this.scrollTo(chapter, scrollTarget, smooth);
      return;
    }

    this.activeId = id;

    this.chapters.forEach((entry) => {
      const isActive = entry.id === id;

      entry.elements.forEach((element) => {
        element.hidden = !isActive;
      });
    });

    this.links.forEach((link) => {
      const isActive = link.dataset.chapterLink === id;
      const item = link.closest('li');

      item?.classList.toggle('is-active', isActive);

      if (isActive) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    this.updateStatus(chapter);

    if (updateHash) {
      history.replaceState(null, '', `#${encodeURIComponent(id)}`);
    }

    if (scroll) {
      this.scrollTo(chapter, scrollTarget, smooth);
    }
  }

  updateStatus(chapter) {
    const index = this.chapters.findIndex((entry) => entry.id === chapter.id);
    const previous =
      this.chapters[(index - 1 + this.chapters.length) % this.chapters.length];
    const next = this.chapters[(index + 1) % this.chapters.length];

    if (this.positionEl) {
      this.positionEl.textContent = `${pad(index + 1)} / ${pad(
        this.chapters.length,
      )}`;
    }

    if (this.sideIndexEl) this.sideIndexEl.textContent = pad(index + 1);
    if (this.sideTitleEl) this.sideTitleEl.textContent = chapter.title;
    this.sideSteps.forEach((step, stepIndex) => {
      const isCurrent = step.dataset.projectSideStep === chapter.id;
      step.classList.toggle('is-current', isCurrent);
      step.classList.toggle('is-before', stepIndex < index);
    });

    if (this.announceEl) {
      this.announceEl.textContent = `Chapter ${index + 1} of ${
        this.chapters.length
      }: ${chapter.title}`;
    }

    if (this.prevTitleEl) this.prevTitleEl.textContent = previous.title;
    if (this.nextTitleEl) this.nextTitleEl.textContent = next.title;
    this.prevButton?.setAttribute(
      'aria-label',
      `Previous chapter: ${previous.title}`,
    );
    this.nextButton?.setAttribute(
      'aria-label',
      `Next chapter: ${next.title}`,
    );
  }

  scrollTo(chapter, target = 'root', smooth = true) {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const element =
      target === 'chapter' ? chapter.heading : this.root;
    const top = window.scrollY + element.getBoundingClientRect().top - 16;

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: reduceMotion || !smooth ? 'auto' : 'smooth',
    });
  }

  destroy() {
    this.links.forEach((link) => {
      link.removeEventListener('click', this.handleClick);
    });
    this.sideLinks.forEach((link) => {
      link.removeEventListener('click', this.handleClick);
    });
    this.prevButton?.removeEventListener('click', this.handlePrev);
    this.nextButton?.removeEventListener('click', this.handleNext);
    this.root.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('hashchange', this.handleHashChange);
    this.root.classList.remove('project-showproject--enhanced');

    this.sideSteps.forEach((step) => {
      step.classList.remove('is-current', 'is-before');
    });

    this.chapters.forEach((chapter) => {
      chapter.elements.forEach((element) => {
        element.hidden = false;
      });
    });
  }
}
