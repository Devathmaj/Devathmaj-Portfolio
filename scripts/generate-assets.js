import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { injectManifest } from 'workbox-build';

import { buildMusicManifest, MUSIC_ALBUM } from '../lib/music.js';
import { CACHE_DIR, ROOT, readBuildInfo } from './build-info.js';

const SITE_DIR = path.join(ROOT, '_site');
const MANIFEST_FILE = path.join(SITE_DIR, 'assets', 'manifest.json');
const MUSIC_FILE = path.join(SITE_DIR, 'assets', 'music.json');
const SW_SOURCE = path.join(CACHE_DIR, 'sw-bundle.js');
const SW_DEST = path.join(SITE_DIR, 'sw.js');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.aac']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);
const FONT_EXTENSIONS = new Set(['.woff', '.woff2', '.ttf', '.otf']);
const DATA_EXTENSIONS = new Set(['.json', '.webmanifest']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf']);

const toUrlPath = (relativePath) =>
  `/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`;

const decodePath = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const assetType = (url) => {
  const extension = path.extname(decodePath(new URL(url, 'https://site.invalid').pathname)).toLowerCase();
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (FONT_EXTENSIONS.has(extension)) return 'font';
  if (extension === '.css') return 'style';
  if (extension === '.js' || extension === '.mjs') return 'script';
  if (DATA_EXTENSIONS.has(extension)) return 'data';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  return 'other';
};

const sha256 = async (file) => {
  const hash = crypto.createHash('sha256');
  hash.update(await fsp.readFile(file));
  return `sha256-${hash.digest('hex').slice(0, 16)}`;
};

async function walk(directory) {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

const isSkipped = (url) => {
  if (url.endsWith('.html')) return true;
  if (url === '/sw.js') return true;
  if (url === '/assets/manifest.json') return true;
  if (url === '/_headers' || url === '/_redirects') return true;
  if (url.endsWith('.map')) return true;
  return false;
};

const addHomepageUrl = (set, raw) => {
  if (!raw) return;
  const value = raw.trim();
  if (!value || value.startsWith('data:') || value.startsWith('#') || value.startsWith('mailto:')) return;
  let url;
  try {
    url = new URL(value, 'https://site.invalid');
  } catch {
    return;
  }
  if (url.origin !== 'https://site.invalid') return;
  if (!url.pathname.startsWith('/')) return;
  if (url.pathname.startsWith('/music/')) return;
  set.add(url.pathname);
};

async function readHomepageSet() {
  const homepage = new Set();
  const critical = new Set();
  const html = await fsp.readFile(path.join(SITE_DIR, 'index.html'), 'utf8');

  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    addHomepageUrl(homepage, match[1]);
  }
  for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const candidate of match[1].split(',')) {
      addHomepageUrl(homepage, candidate.trim().split(/\s+/)[0]);
    }
  }
  for (const match of html.matchAll(/<link\b[^>]*rel="preload"[^>]*>/g)) {
    const href = /\bhref="([^"]+)"/.exec(match[0]);
    if (href) {
      addHomepageUrl(homepage, href[1]);
      addHomepageUrl(critical, href[1]);
    }
  }
  for (const match of html.matchAll(/<img\b[^>]*(?:loading="eager"|fetchpriority="high")[^>]*>/g)) {
    const src = /\bsrc="([^"]+)"/.exec(match[0]);
    if (src) {
      addHomepageUrl(homepage, src[1]);
      addHomepageUrl(critical, src[1]);
    }
    const srcset = /\bsrcset="([^"]+)"/.exec(match[0]);
    if (srcset) {
      for (const candidate of srcset[1].split(',')) {
        const url = candidate.trim().split(/\s+/)[0];
        addHomepageUrl(homepage, url);
        addHomepageUrl(critical, url);
      }
    }
  }

  // Global stylesheets are homepage dependencies. Their url() references are
  // needed for the visual shell even when a particular rule applies later.
  for (const stylesheet of ['fonts.css', 'style.css']) {
    const cssPath = path.join(SITE_DIR, 'css', stylesheet);
    if (!fs.existsSync(cssPath)) continue;
    const css = await fsp.readFile(cssPath, 'utf8');
    for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
      addHomepageUrl(homepage, match[2]);
    }
  }

  // All JS and fonts are part of the homepage shell: the entry bundle loads
  // the route transition chunks immediately, and fonts.css declares every face.
  const allFiles = await walk(SITE_DIR);
  for (const file of allFiles) {
    const url = toUrlPath(path.relative(SITE_DIR, file));
    if (url.startsWith('/js/') || url.startsWith('/fonts/')) {
      homepage.add(url);
      critical.add(url);
    }
    if (url === '/css/fonts.css' || url === '/css/style.css') {
      homepage.add(url);
      critical.add(url);
    }
  }

  return { homepage, critical };
}

function trackIndex(tracks) {
  const byUrl = new Map();
  for (const track of tracks) {
    for (const source of track.sources) {
      byUrl.set(source.src, track);
    }
  }
  return byUrl;
}

async function main() {
  const build = readBuildInfo();
  if (!fs.existsSync(SITE_DIR)) {
    throw new Error('_site is missing. Run the Eleventy build before generating assets.');
  }

  const tracks = buildMusicManifest();
  const trackByUrl = trackIndex(tracks);
  const catalogueTracks = tracks.map((track) => {
    const audioUrl = track.sources[0]?.src || null;
    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre,
      duration: track.duration ?? null,
      colour: track.colour,
      assetId: audioUrl && trackByUrl.get(audioUrl) ? `track:${track.id}` : null,
      audioUrl,
      artworkUrl: track.artwork ?? null,
      sources: track.sources,
    };
  });

  await fsp.mkdir(path.dirname(MUSIC_FILE), { recursive: true });
  await fsp.writeFile(
    MUSIC_FILE,
    JSON.stringify({ buildId: build.id, album: MUSIC_ALBUM, tracks: catalogueTracks }),
  );

  const { homepage, critical } = await readHomepageSet();
  const files = (await walk(SITE_DIR)).sort();

  const assets = [];
  for (const file of files) {
    const url = toUrlPath(path.relative(SITE_DIR, file));
    if (isSkipped(url)) continue;

    const type = assetType(url);
    const track = type === 'audio' ? trackByUrl.get(url) : null;
    const priorityGroup = type === 'audio' || url.startsWith('/music/')
      ? 'music'
      : homepage.has(url)
        ? 'homepage'
        : 'other';
    const stat = await fsp.stat(file);

    assets.push({
      id: track ? `track:${track.id}` : `${type}:${url}`,
      url,
      type,
      priorityGroup,
      critical: priorityGroup === 'homepage' && critical.has(url),
      revision: await sha256(file),
      size: stat.size,
    });
  }

  const summary = {
    homepage: { count: 0, bytes: 0, criticalCount: 0, criticalBytes: 0 },
    other: { count: 0, bytes: 0 },
    music: { count: 0, bytes: 0 },
    total: { count: 0, bytes: 0 },
  };
  for (const asset of assets) {
    const group = summary[asset.priorityGroup];
    group.count += 1;
    group.bytes += asset.size;
    summary.total.count += 1;
    summary.total.bytes += asset.size;
    if (asset.critical) {
      summary.homepage.criticalCount += 1;
      summary.homepage.criticalBytes += asset.size;
    }
  }

  const manifest = {
    buildId: build.id,
    generatedAt: build.generatedAt,
    assets,
    music: catalogueTracks,
    summary,
  };

  await fsp.mkdir(path.dirname(MANIFEST_FILE), { recursive: true });
  await fsp.writeFile(MANIFEST_FILE, JSON.stringify(manifest));

  if (!fs.existsSync(SW_SOURCE)) {
    throw new Error('Service worker bundle is missing. Run rollup before generating assets.');
  }

  const precacheEntries = assets
    .filter((asset) => asset.critical)
    .map((asset) => ({ url: asset.url, revision: asset.revision }));

  await injectManifest({
    swSrc: SW_SOURCE,
    swDest: SW_DEST,
    globDirectory: SITE_DIR,
    globPatterns: [],
    additionalManifestEntries: precacheEntries,
    injectionPoint: 'self.__WB_MANIFEST',
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  });

  let serviceWorker = await fsp.readFile(SW_DEST, 'utf8');
  serviceWorker = serviceWorker.replaceAll('__SITE_BUILD_ID__', build.id);
  await fsp.writeFile(SW_DEST, serviceWorker);

  console.log(
    `[assets] ${build.id} · homepage ${summary.homepage.count} (${summary.homepage.criticalCount} critical), ` +
      `other ${summary.other.count}, music ${summary.music.count} · ` +
      `${(summary.total.bytes / 1024 / 1024).toFixed(1)} MB total`,
  );
}

main().catch((error) => {
  console.error('[assets] generation failed', error);
  process.exitCode = 1;
});
