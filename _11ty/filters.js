import { JSDOM } from 'jsdom';

export const humanReadableDate = (dateStr) => {
  const date = new Date(dateStr);
  const timezoneDiff = date.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(date.valueOf() + timezoneDiff);
  return adjustedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const sortedByPublishDate = (arr) => {
  return arr.sort(
    (a, b) => new Date(b.data.publishDate) - new Date(a.data.publishDate)
  );
};

export const sortedByWorkOrder = (arr) => {
  return [...arr].sort((a, b) => {
    const aOrder = a.data.workOrder ?? Number.POSITIVE_INFINITY;
    const bOrder = b.data.workOrder ?? Number.POSITIVE_INFINITY;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return new Date(b.data.publishDate) - new Date(a.data.publishDate);
  });
};

export const readTime = (str) => {
  const { document } = new JSDOM(`${str}`).window;
  // Calculate read time without code samples or mathJax.
  const elementsToRemove = [...document.querySelectorAll('pre, mjx-container')];
  elementsToRemove.forEach((element) => element.remove());
  const text = document.body.textContent;

  const wordCount = text.split(' ').length;
  const wordsPerMinute = 200;
  const readingTime = Math.ceil(wordCount / wordsPerMinute);

  return `${readingTime} minute read`;
};

export const toISOString = (str) => {
  return str.toISOString();
};

/**
 * Convert an Eleventy output URL into its public canonical URL.
 *
 * Standalone pages and detail routes are emitted as flat `.html` files so
 * Cloudflare Pages serves them without a trailing slash. Parent section routes
 * use `index.html` and keep their trailing slash. The 404 document is kept
 * verbatim because it is not an indexable route.
 */
export const canonicalUrl = (url = '/') => {
  const path = String(url).split(/[?#]/)[0] || '/';
  if (path === '/404.html') return path;
  if (path === '/index.html') return '/';
  if (path.endsWith('/index.html')) return path.slice(0, -'index.html'.length);
  if (path.endsWith('.html')) return path.slice(0, -'.html'.length);
  return path;
};

/** Build the output path for a page's Open Graph image document. */
export const opengraphPermalink = (url = '/') => {
  const path = canonicalUrl(url);
  if (path === '/') return '/opengraph/index.html';
  return path.endsWith('/')
    ? `/opengraph${path}index.html`
    : `/opengraph${path}.html`;
};

export const getProjectNeighbors = (items, url) => {
  const index = items.findIndex((item) => item.url === url);

  if (index === -1) {
    return { previous: null, next: null };
  }

  const total = items.length;

  return {
    previous: total > 1 ? items[(index - 1 + total) % total] : null,
    next: total > 1 ? items[(index + 1) % total] : null,
  };
};

const hiddenProjectSectionIds = new Set(['stack', 'codebase']);

const technologyIconAliases = [
  ['typescript', 'typescript'],
  ['javascript', 'javascript'],
  ['react', 'react'],
  ['fastapi', 'fastapi'],
  ['flask', 'flask'],
  ['sqlalchemy', 'sqlalchemy'],
  ['pydantic', 'pydantic'],
  ['postgres', 'postgresql'],
  ['mysql', 'mysql'],
  ['mongo', 'mongodb'],
  ['redis', 'redis'],
  ['supabase', 'supabase'],
  ['docker', 'docker'],
  ['github actions', 'githubactions'],
  ['nginx', 'nginx'],
  ['linux', 'linux'],
  ['cloudflare', 'cloudflarepages'],
  ['opentelemetry', 'opentelemetry'],
  ['prometheus', 'prometheus'],
  ['grafana', 'grafana'],
  ['pytest', 'pytest'],
  ['selenium', 'selenium'],
  ['rclone', 'rclone'],
  ['owasp zap', 'zap'],
  ['gemini', 'gemini'],
  ['google cloud', 'googlecloud'],
  ['azure', 'azure'],
  ['aws', 'aws'],
  ['loki', 'loki'],
  ['ssh', 'ssh'],
  ['python', 'python'],
  ['c', 'c'],
  ['jwt', 'jwt'],
  ['websocket', 'websocket'],
  ['openapi', 'openapi'],
];

export const getTechIcon = (technology) => {
  const normalizedTechnology = technology.toLowerCase().trim();
  const alias = technologyIconAliases.find(([name]) =>
    normalizedTechnology.includes(name),
  );

  return alias?.[1] || 'terminal';
};

const isHiddenProjectHeading = (heading) => {
  const id = (heading.getAttribute('id') || '').trim().toLowerCase();
  const text = heading.textContent.trim().toLowerCase();
  return hiddenProjectSectionIds.has(id) || hiddenProjectSectionIds.has(text);
};

const getTOC = (md) => {
  const { document } = new JSDOM(md).window;
  return [...document.querySelectorAll('h2')].map((h2) => {
    if (h2.textContent) {
      return { text: h2.textContent, id: h2.id };
    }
  });
};

export const projectTOC = (md) => {
  return getTOC(md).filter(({ id, text }) => {
    const key = (id || '').trim().toLowerCase();
    const label = (text || '').trim().toLowerCase();
    return !hiddenProjectSectionIds.has(key) && !hiddenProjectSectionIds.has(label);
  });
};

export const projectContent = (html) => {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  const { body } = document;

  [...body.querySelectorAll('h2')]
    .filter(isHiddenProjectHeading)
    .forEach((heading) => {
      let node = heading;

      while (node) {
        const next = node.nextElementSibling;
        node.remove();

        if (!next || next.tagName === 'H2') break;
        node = next;
      }
    });

  return body.innerHTML;
};

export const projectRecords = (html) => {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  const { body } = document;

  [...body.querySelectorAll('h3')].forEach((heading) => {
    if (heading.parentElement !== body) return;

    const record = document.createElement('div');
    record.className = 'project-record';
    heading.before(record);
    record.appendChild(heading);

    let next = record.nextElementSibling;

    while (
      next &&
      ['P', 'UL', 'OL'].includes(next.tagName) &&
      !next.querySelector('img')
    ) {
      const after = next.nextElementSibling;
      record.appendChild(next);
      next = after;
    }
  });

  return body.innerHTML;
};

export const getProjectStack = (html) => {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  const heading = [...document.querySelectorAll('h2')].find(
    (h2) => h2.id === 'stack' || h2.textContent.trim().toLowerCase() === 'stack'
  );

  if (!heading) {
    return [];
  }

  let paragraph = heading.nextElementSibling;
  while (paragraph && paragraph.tagName !== 'P') {
    paragraph = paragraph.nextElementSibling;
  }

  if (!paragraph) {
    return [];
  }

  const items = paragraph.textContent
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length) {
    const last = items[items.length - 1];
    if (last.endsWith('.') && !last.slice(0, -1).includes('.')) {
      items[items.length - 1] = last.slice(0, -1);
    }
  }

  return items;
};

export const projectFigures = (html, cover) => {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  const { body } = document;

  [...body.querySelectorAll('p')].forEach((paragraph) => {
    const images = paragraph.querySelectorAll('img');
    if (images.length !== 1) return;

    const meaningfulChildren = [...paragraph.childNodes].filter(
      (node) => node.nodeType !== 3 || node.textContent.trim()
    );
    if (meaningfulChildren.length !== 1) return;

    const image = images[0];
    if (cover && image.getAttribute('src') === cover) {
      paragraph.remove();
      return;
    }

    const figure = document.createElement('figure');
    figure.className = 'project-figure';

    const picture = image.closest('picture');
    let media = picture || image;
    const existingLink = image.closest('a');

    if (!existingLink) {
      const source = picture?.querySelector('source[srcset]');
      const sourceSet = source?.getAttribute('srcset');
      const largestImage = sourceSet
        ? sourceSet.split(',').pop().trim().split(/\s+/)[0]
        : image.getAttribute('src');
      const link = document.createElement('a');
      link.href = largestImage;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Open image: ${image.getAttribute('alt') || 'project image'}`);
      media = link;
      link.appendChild(picture || image);
    } else {
      media = existingLink;
    }

    figure.appendChild(media);

    const caption = image.getAttribute('alt');
    if (caption) {
      const figcaption = document.createElement('figcaption');
      figcaption.textContent = caption;
      figure.appendChild(figcaption);
    }

    paragraph.replaceWith(figure);
  });

  [...body.querySelectorAll('figure.project-figure img')].forEach((image) => {
    if (image.closest('a')) return;

    const picture = image.closest('picture');
    const sourceSet = picture?.querySelector('source[srcset]')?.getAttribute('srcset');
    const largestImage = sourceSet
      ? sourceSet.split(',').pop().trim().split(/\s+/)[0]
      : image.getAttribute('src');
    if (!largestImage) return;

    const link = document.createElement('a');
    link.href = largestImage;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute(
      'aria-label',
      `Open image: ${image.getAttribute('alt') || 'project image'}`,
    );
    (picture || image).replaceWith(link);
    link.appendChild(picture || image);
  });

  let run = [];
  const flushGallery = () => {
    if (run.length < 2) {
      run = [];
      return;
    }

    const gallery = document.createElement('div');
    gallery.className = 'project-gallery';
    run[0].before(gallery);
    run.forEach((figure) => gallery.appendChild(figure));
    run = [];
  };

  [...body.children].forEach((child) => {
    if (child.matches('figure.project-figure')) {
      run.push(child);
      return;
    }

    flushGallery();
  });
  flushGallery();

  return body.innerHTML;
};
