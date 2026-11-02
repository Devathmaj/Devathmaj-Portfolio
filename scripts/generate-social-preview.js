// Regenerates the social-preview derivatives from the master artwork.
//
// Masters are the single source of truth for every external preview. The
// default portfolio image powers the home page and any page without a section
// image; projects, about and contact have their own masters. Run this after
// replacing a master and redeploy, then re-scrape the platforms listed in
// docs/social-previews.md.
import path from 'node:path';

import sharp from 'sharp';

const OUT_DIR = 'src/meta';
const BACKGROUND = '#fafafa';

const ARTWORKS = [
  {
    source: 'src/meta/devathmaj-portfolio-preview.png',
    base: 'devathmaj-portfolio-preview',
    github: true,
  },
  {
    source: 'src/meta/devathmaj-project-preview.png',
    base: 'devathmaj-project-preview',
  },
  {
    source: 'src/meta/devathmaj-about-preview.png',
    base: 'devathmaj-about-preview',
  },
  {
    source: 'src/meta/devathmaj-contact-preview.png',
    base: 'devathmaj-contact-preview',
  },
];

const VARIANTS = [
  // Open Graph, Twitter/X, LinkedIn, Facebook, WhatsApp, Discord, Slack,
  // Telegram and most other link unfurlers.
  { name: '1200x630.png', width: 1200, height: 630, fit: 'cover', format: 'png' },
  { name: '1200x630.jpg', width: 1200, height: 630, fit: 'cover', format: 'jpg' },

  // Square fallback for cards and profiles that crop to 1:1.
  {
    name: '1200x1200.png',
    width: 1200,
    height: 1200,
    fit: 'contain',
    format: 'png',
  },

  // Compact variant for email signatures and small embeds.
  { name: '600x315.png', width: 600, height: 315, fit: 'cover', format: 'png' },
];

// GitHub repository social preview (2:1). Contain so no artwork is cropped.
const GITHUB_VARIANT = {
  name: '1280x640.png',
  width: 1280,
  height: 640,
  fit: 'contain',
  format: 'png',
};

const tasks = [];

for (const artwork of ARTWORKS) {
  const variants = artwork.github
    ? [...VARIANTS, GITHUB_VARIANT]
    : VARIANTS;

  for (const variant of variants) {
    const pipeline = sharp(artwork.source).resize(variant.width, variant.height, {
      fit: variant.fit,
      position: 'centre',
      background: BACKGROUND,
    });
    const output = path.join(
      OUT_DIR,
      `${artwork.base}-${variant.name}`
    );

    if (variant.format === 'jpg') {
      tasks.push(
        pipeline
          .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
          .toFile(output)
      );
    } else {
      tasks.push(pipeline.png({ compressionLevel: 9 }).toFile(output));
    }
  }
}

await Promise.all(tasks);

console.log(`Social preview derivatives written to ${OUT_DIR}`);
