import dedent from 'dedent';

import { markdownLibrary } from './libraries.js';
import { footnotePlugin } from './misc.js';

export const asMarkdown = function (str) {
  // `dedent` solves for indentation that happens naturally in HTML files for readability
  const content = dedent(str.trim());
  markdownLibrary.use(footnotePlugin);
  return markdownLibrary.render(content);
};

/**
 * Formats the build time as a short clock label ("10:41 PM"). Replaces the
 * `webc:setup` helpers that used to live inside the home components.
 */
export const clockTime = function (timeZone) {
  const options = { hour: 'numeric', minute: 'numeric', hour12: true };
  if (timeZone) options.timeZone = timeZone;

  return new Date().toLocaleString('en-US', options);
};
