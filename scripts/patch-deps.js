import fs from 'node:fs';
import path from 'node:path';

/**
 * @11ty/eleventy-plugin-webc@0.11.2 assumes every render has a page URL and
 * calls Eleventy's CSS/JS bundle helpers. Eleventy 3 renders some component
 * contexts without a page, so guard the bundling block.
 *
 * This is the npm equivalent of the Bun patch that shipped with the project.
 */
const webcTarget = path.join(
  'node_modules',
  '@11ty',
  'eleventy-plugin-webc',
  'src',
  'eleventyWebcTemplate.js',
);

if (!fs.existsSync(webcTarget)) {
  console.warn(`patch-deps: ${webcTarget} not found (run npm install first)`);
} else {
  const source = fs.readFileSync(webcTarget, 'utf8');

  if (source.includes('if (data.page.url) {')) {
    console.log('patch-deps: @11ty/eleventy-plugin-webc already patched');
  } else {
    const original = `				// Add CSS to bundle
				this.config.javascriptFunctions.css(css, "default", data.page.url);

				if(buckets.css) {
					for(let bucket in buckets.css) {
						this.config.javascriptFunctions.css(buckets.css[bucket], bucket, data.page.url);
					}
				}

				// Add JS to bundle
				this.config.javascriptFunctions.js(js, "default", data.page.url);

				if(buckets.js) {
					for(let bucket in buckets.js) {
						this.config.javascriptFunctions.js(buckets.js[bucket], bucket, data.page.url);
					}
				}`;

    const replacement = `				if (data.page.url) {
					// Add CSS to bundle
					this.config.javascriptFunctions.css(css, "default", data.page.url);

					if(buckets.css) {
						for(let bucket in buckets.css) {
							this.config.javascriptFunctions.css(buckets.css[bucket], bucket, data.page.url);
						}
					}

					// Add JS to bundle
					this.config.javascriptFunctions.js(js, "default", data.page.url);

					if(buckets.js) {
						for(let bucket in buckets.js) {
							this.config.javascriptFunctions.js(buckets.js[bucket], bucket, data.page.url);
						}
					}
				}`;

    if (!source.includes(original)) {
      console.error('patch-deps: expected WebC plugin block not found; patch not applied');
    } else {
      fs.writeFileSync(webcTarget, source.replace(original, replacement));
      console.log('patch-deps: patched @11ty/eleventy-plugin-webc');
    }
  }
}

/**
 * @unseenco/taxi@1.8.0 strips trailing slashes, which turns the homepage URL
 * into an empty pathname. Route transitions leaving "/" then never match their
 * from-pattern, so the first click from the homepage falls back to a full page
 * load. Normalize the empty pathname back to "/" before matching.
 *
 * The package resolves to src/taxi.js (see its "main" field), so the readable
 * source is what Rollup actually bundles.
 */
const taxiTarget = path.join(
  'node_modules',
  '@unseenco',
  'taxi',
  'src',
  'RouteStore.js',
);

if (!fs.existsSync(taxiTarget)) {
  console.warn(`patch-deps: ${taxiTarget} not found (run npm install first)`);
} else {
  const taxiSource = fs.readFileSync(taxiTarget, 'utf8');

  const taxiOriginal = `\t\tfor (const [fromPattern, potentialMatches] of this.data) {
\t\t\t// If we have a match
\t\t\tif (currentUrl.pathname.match(this.regexCache.get(fromPattern))) {`;

  const taxiReplacement = `\t\tfor (const [fromPattern, potentialMatches] of this.data) {
\t\t\tlet currentUrlPathname = currentUrl.pathname;
\t\t\tif (currentUrl.pathname === '') {
\t\t\t\tcurrentUrlPathname = '/';
\t\t\t}
\t\t\t// If we have a match
\t\t\tif (currentUrlPathname.match(this.regexCache.get(fromPattern))) {`;

  if (taxiSource.includes('currentUrlPathname')) {
    console.log('patch-deps: @unseenco/taxi already patched');
  } else if (!taxiSource.includes(taxiOriginal)) {
    console.warn('patch-deps: expected Taxi route block not found; patch not applied');
  } else {
    fs.writeFileSync(
      taxiTarget,
      taxiSource.replace(taxiOriginal, taxiReplacement),
    );
    console.log('patch-deps: patched @unseenco/taxi');
  }
}
