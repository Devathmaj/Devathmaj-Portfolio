export default {
  permalink: function ({ title }) {
    return `/projects/${this.slugify(title)}.html`;
  },
  backLink: '/projects/',
  backLinkText: 'All projects',
  layout: 'layouts/_project.njk',
  tags: ['project'],
  hasToc: true,
  briefAbstract: false,
  tocHasTitle: true,
  eleventyComputed: {
    projectStyle: (data) => data.projectStyle || 'dashboard',
    heroLayout: (data) => data.heroLayout || 'stack',
    coverAspect: (data) => data.coverAspect || '16 / 9',
    coverFit: (data) => data.coverFit || 'cover',
    coverPosition: (data) => data.coverPosition || 'top center',
    meta: function ({ abstract }) {
      return {
        description: abstract && abstract,
      };
    },
    og: function ({ title, slug }) {
      let slugged = slug;
      if (!slug) {
        slugged = this.slugify(title);
      }
      const ogTargetUrl = `https://devathmaj.me/opengraph/projects/${slugged}`;
      const ogScreenshotUrl = `https://v1.screenshot.11ty.dev/${encodeURIComponent(
        ogTargetUrl
      )}/opengraph`;
      return ogScreenshotUrl;
    },
    footerLinks: (data) => [
      ...data.footerLinks,
      { name: 'Projects', url: '/projects/' },
      { name: data.title, url: data.url, isTitle: true },
    ],
  },
  eleventyNavigation: {
    parent: 'Projects',
    key: function ({ title }) {
      return title;
    },
  },
};
