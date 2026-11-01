import { readBuildInfo } from '../../scripts/build-info.js';

export default function build() {
  // The fallback is a development id so a direct Eleventy run never enables
  // production caching without the prepare-build step.
  return readBuildInfo({ dev: true });
}
