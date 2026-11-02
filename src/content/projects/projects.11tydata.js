export default {
  permalink: function ({ title }) {
    return `/projects/${this.slugify(title)}.html`;
  },
  backLink: '/projects/',
  backLinkText: 'All projects',
  layout: 'layouts/_project.njk',
  tags: ['project'],
  ogImageKey: 'projects',
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
