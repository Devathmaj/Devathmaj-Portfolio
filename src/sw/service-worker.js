import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// Replaced by scripts/generate-assets.js after Workbox injects the precache
// manifest. It deliberately changes on every production build so the browser's
// normal service-worker update check can discover new deployments.
const BUILD_ID = '__SITE_BUILD_ID__';

const ASSET_CACHE = 'portfolio-assets-v1';
const META_CACHE = 'portfolio-meta-v1';
const ASSET_MAP_URL = '/__asset-map__';
const ASSET_PATH = /^\/(?:img|fonts|music|css|js|assets|meta|certificate|resume)\//;

let assetMapPromise = null;

const sameOrigin = (url) => url.origin === self.location.origin;
const isApi = (url) => url.pathname.startsWith('/api/');
const isAsset = (url) =>
  ASSET_PATH.test(url.pathname) ||
  url.pathname === '/robots.txt' ||
  url.pathname === '/sitemap.xml';

async function getAssetMap() {
  if (!assetMapPromise) {
    assetMapPromise = (async () => {
      try {
        const cache = await caches.open(META_CACHE);
        const response = await cache.match(ASSET_MAP_URL);
        if (!response) return { buildId: null, map: {} };
        return await response.json();
      } catch {
        return { buildId: null, map: {} };
      }
    })();
  }
  return assetMapPromise;
}

async function rangeResponse(response, request) {
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');

  const range = request.headers.get('range');
  if (!range) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const blob = await response.clone().blob();
  const size = blob.size;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) return response;

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!match[1] && match[2]) {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  }

  if (start >= size || end < start) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });
  }

  end = Math.min(end, size - 1);
  const chunk = blob.slice(start, end + 1);
  headers.set('Content-Length', String(chunk.size));
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');

  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers,
  });
}

async function cachedAsset(request) {
  const url = new URL(request.url);
  const cache = await caches.open(ASSET_CACHE);
  const map = (await getAssetMap()).map || {};
  const key = map[url.pathname] || (url.searchParams.has('__rev') ? url.href : null);
  if (!key) return null;

  let response = await cache.match(key);
  if (!response && url.searchParams.has('__rev')) {
    response = await cache.match(url.href);
  }
  if (!response) return null;
  return rangeResponse(response, request);
}

async function networkAsset(request, event) {
  const url = new URL(request.url);
  const map = (await getAssetMap()).map || {};
  const revisionKey = map[url.pathname];
  const isSchedulerDownload = request.headers.get('X-Asset-Download') === '1';
  const response = await fetch(request);

  // A 206 is a partial media response. It must never be stored as a complete
  // file. Full 200 responses can be cached even when they came from the media
  // element rather than the scheduler.
  if (
    !isSchedulerDownload &&
    response.ok &&
    response.status === 200 &&
    request.method === 'GET' &&
    revisionKey
  ) {
    const cache = await caches.open(ASSET_CACHE);
    event?.waitUntil?.(cache.put(revisionKey, response.clone()));
  }

  return response;
}

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// A first install takes control of the page that registered it. Updates are
// activated on request by the page (SKIP_WAITING) and the page then reloads
// once, so the new worker and the document always describe the same build.
let firstInstall = false;

self.addEventListener('install', () => {
  firstInstall = !self.registration.active;
  if (firstInstall) self.skipWaiting();
});

registerRoute(
  ({ url }) => sameOrigin(url) && isApi(url),
  new NetworkOnly(),
);

registerRoute(
  ({ url, request }) =>
    sameOrigin(url) && request.method === 'GET' && isAsset(url),
  async ({ request, event }) => {
    const cached = await cachedAsset(request);
    if (cached) return cached;
    return networkAsset(request, event);
  },
);

// HTML stays network-only so a new deployment is discovered through the
// embedded build id and the service-worker update check, never a stale page.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkOnly(),
);

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    const port = event.ports?.[0];
    port?.postMessage({ type: 'SKIP_WAITING_STARTED' });
    try {
      const activation = self.skipWaiting();
      event.waitUntil?.(activation);
      activation.then(
        () => port?.postMessage({ type: 'SKIP_WAITING_ACK' }),
        (error) =>
          port?.postMessage({
            type: 'SKIP_WAITING_ERROR',
            error: String(error),
          }),
      );
    } catch (error) {
      port?.postMessage({
        type: 'SKIP_WAITING_THROW',
        error: String(error),
      });
    }
    return;
  }

  if (data.type === 'ASSET_MAP_UPDATED') {
    assetMapPromise = null;
  }

  if (data.type === 'GET_BUILD_ID' && event.ports?.[0]) {
    event.ports[0].postMessage({ buildId: BUILD_ID });
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Only a first install takes control of the page that registered it. An
      // update is activated explicitly by the page, which then reloads; the new
      // worker does not claim the old document itself.
      if (firstInstall) await self.clients.claim();

      // Old build entries stay in portfolio-assets-v1 until the application has
      // successfully reconciled the new manifest and written the new asset map.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('portfolio-pages-') && name !== 'portfolio-pages-v1')
          .map((name) => caches.delete(name)),
      );
    })(),
  );
});
