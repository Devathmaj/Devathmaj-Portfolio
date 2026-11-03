import fs from 'node:fs';
import path from 'node:path';

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
