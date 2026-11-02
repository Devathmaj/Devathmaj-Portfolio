import path from 'node:path';

import { EleventyRenderPlugin as pluginRender } from '@11ty/eleventy';
import { eleventyImageTransformPlugin as pluginImage } from '@11ty/eleventy-img';
import pluginWebc from '@11ty/eleventy-plugin-webc';
import {
  humanReadableDate,
  sortedByPublishDate,
  sortedByWorkOrder,
  readTime,
  toISOString,
  canonicalUrl,
  opengraphPermalink,
  getProjectNeighbors,
  getProjectStack,
  getTechIcon,
  projectTOC,
  projectContent,
  projectRecords,
  projectFigures,
} from './_11ty/filters.js';
import { markdownLibrary } from './_11ty/libraries.js';
import { collectionHostedProject } from './_11ty/collections.js';
import { asMarkdown } from './_11ty/shortcodes.js';

/**
 *  @param {import("@11ty/eleventy/src/UserConfig")} eleventyConfig
 */
export default async function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginRender);
  eleventyConfig.addPlugin(pluginImage, {
    extensions: 'html',
    formats: ['webp', 'jpeg'],
    widths: ['auto', 400, 800, 1400],
    defaultAttributes: {
      loading: 'lazy',
      decoding: 'async',
      sizes: '100vw',
    },
    filenameFormat: function (id, src, width, format, options) {
      const extension = path.extname(src);
      const name = path.basename(src, extension);

      return `${name}-${width}w.${format}`;
    },
    sharpOptions: {
      animated: true,
      limitInputPixels: false,
    },
  });
  eleventyConfig.addPlugin(pluginWebc, {
    components: ['./src/_components/**/*.webc'],
  });

  eleventyConfig.addWatchTarget('./src/scss/**/*');
  eleventyConfig.addWatchTarget('./src/js/**/*');

  eleventyConfig.addPassthroughCopy('./src/js/vendor', 'js');
  eleventyConfig.addPassthroughCopy('./src/meta');
  eleventyConfig.addPassthroughCopy({ './src/meta/favicon.ico': 'favicon.ico' });
  eleventyConfig.addPassthroughCopy('./src/fonts');
  eleventyConfig.addPassthroughCopy(
    './src/img/**/*.{png,jpg,jpeg,webp,avif,gif,svg}'
  );
  eleventyConfig.addPassthroughCopy('./src/music');
  eleventyConfig.addWatchTarget('./src/music/**/*');
  eleventyConfig.addWatchTarget('./lib/music.js');
  eleventyConfig.addPassthroughCopy('./src/resume');
  eleventyConfig.addPassthroughCopy('./src/certificate');
  eleventyConfig.addPassthroughCopy('./src/robots.txt');
  eleventyConfig.addPassthroughCopy({
    './src/_headers': '_headers',
    './src/_redirects': '_redirects',
  });

  eleventyConfig.ignores.add('**/img/**/*.md');

  eleventyConfig.addCollection('hosted project', collectionHostedProject);

  eleventyConfig.addFilter('sortedByPublishDate', sortedByPublishDate);
  eleventyConfig.addFilter('sortedByWorkOrder', sortedByWorkOrder);
  eleventyConfig.addFilter('readTime', readTime);
  eleventyConfig.addFilter('humanReadableDate', humanReadableDate);
  eleventyConfig.addFilter('toISOString', toISOString);
  eleventyConfig.addFilter('canonicalUrl', canonicalUrl);
  eleventyConfig.addFilter('opengraphPermalink', opengraphPermalink);
  eleventyConfig.addFilter('getProjectNeighbors', getProjectNeighbors);
  eleventyConfig.addFilter('getProjectStack', getProjectStack);
  eleventyConfig.addFilter('getTechIcon', getTechIcon);
  eleventyConfig.addFilter('projectTOC', projectTOC);
  eleventyConfig.addFilter('projectContent', projectContent);
  eleventyConfig.addFilter('projectRecords', projectRecords);
  eleventyConfig.addFilter('projectFigures', projectFigures);

  eleventyConfig.addPairedShortcode('asMarkdown', asMarkdown);

  eleventyConfig.setLibrary('md', markdownLibrary);

  return {
    dir: {
      input: 'src',
    },
  };
}
