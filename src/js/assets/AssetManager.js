import { AssetScheduler, ASSET_CACHE } from './AssetScheduler.js';
import {
  getActiveBuildId,
  getMeta,
  getPendingBuild,
  setMeta,
} from './db.js';

const MANIFEST_URL = '/assets/manifest.json';
const META_CACHE = 'portfolio-meta-v1';
const ASSET_MAP_URL = '/__asset-map__';
const SW_URL = '/sw.js';
const SW_SCOPE = '/';
const CONTROLLER_TIMEOUT = 20000;
const MESSAGE_TIMEOUT = 2000;
const HANDOVER_TIMEOUT = 5000;
const RELOAD_KEY = 'asset:reload-build';

const revisionKey = (asset) => {
  const url = new URL(asset.url, window.location.origin);
  url.searchParams.set('__rev', asset.revision);
  return url.href;
};

const whenIdle = (callback) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 2500 });
  } else {
    window.setTimeout(callback, 250);
  }
};

/**
 * Owns the browser-side asset library.
 *
 * The page build id is the single source of truth for the current deployment.
 * The manifest, the service worker and every API response must agree with it
 * before anything is cached. A deployment that appears while an older page is
 * open is activated immediately and the page is reloaded once, because a worker
 * left waiting has been observed to strand the next navigation in Chrome.
 */
class AssetManager {
  constructor() {
    const meta = document.querySelector('meta[name="site-build"]');
    this.buildId = meta?.getAttribute('content')?.trim() || null;
    this.isDev = !this.buildId || this.buildId.startsWith('dev-');
    this.supported =
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      'caches' in window;

    this.registration = null;
    this.scheduler = null;
    this.manifest = null;
    this.progress = null;
    this.mode = 'idle';
    this.deployment = null;
    this.mismatch = null;
    this.ready = null;
    this.started = false;
    this.handedOver = false;
    this.precacheAdoption = null;
    this.listeners = new Set();
  }

  /** Start the library without blocking the page. Safe to call repeatedly. */
  start() {
    if (this.ready) return this.ready;
    this.ready = this.bootstrap().catch((error) => {
      console.warn('[assets] Asset library unavailable', error);
      this.setMode('error');
      return null;
    });
    return this.ready;
  }

  setMode(mode) {
    this.mode = mode;
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.assetMode = mode;
    }
  }

  async bootstrap() {
    if (!this.buildId) {
      this.setMode('no-build');
      return null;
    }

    // Development builds deliberately keep the old network-only behaviour.
    if (this.isDev) {
      this.setMode('development');
      return null;
    }

    if (!this.supported) {
      this.setMode('unsupported');
      return null;
    }

    // Entries marked obsolete by the previous commit survive one full session
    // so an older tab cannot lose files it still references.
    await this.cleanupObsolete();

    this.registration = await this.registerServiceWorker();
    if (!this.registration) {
      this.setMode('no-service-worker');
      return null;
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.handleControllerChange();
    });

    let controllerBuild = await this.waitForControllerBuild(this.registration);
    if (controllerBuild && controllerBuild !== this.buildId) {
      // The page is newer than the worker that controls it. Activate the
      // waiting worker and reload once so the document and its precache come
      // from the same build.
      const recovery = await this.recoverController(
        this.registration,
        controllerBuild,
      );
      if (recovery === 'reloading') return null;
      controllerBuild = await this.requestBuildId(
        navigator.serviceWorker.controller,
      );
    }

    const precacheHandled = controllerBuild === this.buildId;
    if (precacheHandled) this.clearReloadGuard();
    const manifest = await this.fetchManifest();
    if (!manifest) {
      this.setMode('no-manifest');
      return null;
    }

    if (manifest.buildId !== this.buildId) {
      // The HTML is older than the deployment. Never mix revisions from two
      // builds; the next full navigation will get matching HTML and manifest.
      this.mismatch = { page: this.buildId, manifest: manifest.buildId };
      this.setMode('build-mismatch');
      document.dispatchEvent(
        new CustomEvent('asset:build-mismatch', { detail: this.mismatch }),
      );
      return null;
    }

    this.manifest = manifest;
    this.scheduler = new AssetScheduler({
      buildId: this.buildId,
      precacheHandled,
      onUpdate: (progress) => this.emit(progress),
      onCommit: (committed) => this.handleCommit(committed),
    });

    const activeBuildId = await getActiveBuildId();
    const pending = await getPendingBuild();

    if (
      activeBuildId === manifest.buildId ||
      pending?.buildId === manifest.buildId
    ) {
      const resuming =
        activeBuildId !== manifest.buildId &&
        pending?.buildId === manifest.buildId;
      this.setMode(resuming ? 'resume' : 'active');
      await this.scheduler.initialize(manifest, { precacheHandled });
    } else {
      this.setMode('reconcile');
      await this.scheduler.reconcile(manifest, { precacheHandled });
    }

    // Write a provisional map immediately. Assets that are not downloaded yet
    // simply miss the cache and fall through to the network.
    await this.writeAssetMap(manifest, precacheHandled);
    this.emit(this.scheduler.getProgress());
    this.scheduleStart();
    // The worker may finish installing after the controller wait timed out.
    // Adopt whatever it has precached before the scheduler re-fetches it.
    if (!precacheHandled) this.schedulePrecacheAdoption();
    return this;
  }

  async registerServiceWorker() {
    try {
      // Re-registering while an updated worker is already waiting has been
      // observed to leave the register() promise pending forever in Chrome,
      // which silently stalls the whole asset bootstrap. When a registration
      // exists we only need an update check, so trigger it without awaiting.
      let registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      if (registration) {
        registration.update().catch(() => {});
      } else {
        registration = await navigator.serviceWorker.register(SW_URL, {
          scope: SW_SCOPE,
          updateViaCache: 'none',
        });
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state !== 'installed') return;
          if (!navigator.serviceWorker.controller) return;
          this.noteDeployment(null, 'service-worker');
          // Activate the update right away instead of leaving it waiting. A
          // worker that is still waiting when the next document loads is
          // stranded in Chrome: skipWaiting is then ignored and the following
          // navigation hangs.
          this.handoverUpdate(worker);
        });
      });

      return registration;
    } catch (error) {
      console.warn('[assets] Service worker registration failed', error);
      return null;
    }
  }

  async waitForControllerBuild(registration) {
    let controller = navigator.serviceWorker.controller;

    if (!controller) {
      controller = await new Promise((resolve) => {
        const timer = window.setTimeout(() => {
          resolve(navigator.serviceWorker.controller || registration.active || null);
        }, CONTROLLER_TIMEOUT);

        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            window.clearTimeout(timer);
            resolve(navigator.serviceWorker.controller);
          },
          { once: true },
        );
      });
    }

    return this.requestBuildId(controller);
  }

  requestBuildId(worker) {
    if (!worker || typeof worker.postMessage !== 'function') {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = window.setTimeout(() => resolve(null), MESSAGE_TIMEOUT);

      channel.port1.onmessage = (event) => {
        window.clearTimeout(timer);
        resolve(event.data?.buildId || null);
      };

      try {
        worker.postMessage({ type: 'GET_BUILD_ID' }, [channel.port2]);
      } catch {
        window.clearTimeout(timer);
        resolve(null);
      }
    });
  }

  /**
   * Ask a worker to activate. Resolves true only when the worker confirms it
   * became active. A worker that was left waiting across a document load can
   * accept the message but never activate in Chrome, so a timeout means "stay
   * on the current controller".
   */
  skipWaiting(worker) {
    return new Promise((resolve) => {
      if (!worker || typeof worker.postMessage !== 'function') {
        resolve(false);
        return;
      }

      const channel = new MessageChannel();
      const timer = window.setTimeout(() => resolve(false), HANDOVER_TIMEOUT);

      channel.port1.onmessage = (event) => {
        const type = event.data?.type;
        if (type === 'SKIP_WAITING_STARTED') return;
        window.clearTimeout(timer);
        resolve(type === 'SKIP_WAITING_ACK');
      };

      try {
        worker.postMessage({ type: 'SKIP_WAITING' }, [channel.port2]);
      } catch {
        window.clearTimeout(timer);
        resolve(false);
      }
    });
  }

  /** Wait until the controller reports a build other than this page's build. */
  async waitForControllerBuildChange(timeout = HANDOVER_TIMEOUT) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const build = await this.requestBuildId(navigator.serviceWorker.controller);
      if (build && build !== this.buildId) return build;
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }

    return null;
  }

  clearReloadGuard() {
    try {
      window.sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // Storage is best-effort.
    }
  }

  /** Reload at most once per build, even if several events race. */
  reloadForBuild(build) {
    if (!build || build === this.buildId) return false;

    let previous = null;
    try {
      previous = window.sessionStorage.getItem(RELOAD_KEY);
    } catch {
      // Storage is best-effort.
    }
    if (previous === build) return false;

    try {
      window.sessionStorage.setItem(RELOAD_KEY, build);
    } catch {
      // Storage is best-effort.
    }

    window.location.reload();
    return true;
  }

  /** A controller activated by another page or by our own handover. */
  async handleControllerChange() {
    const build = await this.requestBuildId(navigator.serviceWorker.controller);
    if (!build) return;
    if (build === this.buildId) {
      this.clearReloadGuard();
      // This is the first-install handover that arrived after the timeout.
      // Take over the precached critical assets instead of downloading them.
      this.adoptPrecache();
      return;
    }
    this.reloadForBuild(build);
  }

  /**
   * The controller appeared after the bootstrap timeout, so the scheduler may
   * already be fetching critical assets that the worker has precached. Adopt
   * them before more duplicate requests go out.
   */
  schedulePrecacheAdoption() {
    if (navigator.serviceWorker.controller) {
      this.adoptPrecache();
      return;
    }

    // controllerchange is the normal signal, but it can be missed when the
    // worker claims the page between the timeout and scheduler creation.
    window.setTimeout(() => {
      if (navigator.serviceWorker.controller) this.adoptPrecache();
    }, 1000);
  }

  /**
   * Inspect the Workbox precache for this build and hand its verified entries
   * to the scheduler. Safe to call repeatedly; the scheduler deduplicates.
   */
  async adoptPrecache() {
    if (!this.scheduler || !this.manifest) return null;
    if (this.scheduler.precacheHandled) return null;
    if (this.precacheAdoption) return this.precacheAdoption;

    this.precacheAdoption = (async () => {
      let build = await this.requestBuildId(navigator.serviceWorker.controller);
      if (!build && navigator.serviceWorker.controller) {
        // The worker can accept controllerchange a moment before it answers
        // messages. One short retry covers that startup window.
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        build = await this.requestBuildId(navigator.serviceWorker.controller);
      }
      if (!build || build !== this.buildId) return null;

      const result = await this.scheduler.adoptPrecache();
      if (result && (result.adopted > 0 || result.verified > 0)) {
        // Adopted assets are served by the Workbox precache route, so the
        // regular asset map must stop pointing at their deleted duplicates.
        await this.writeAssetMap(this.manifest, this.scheduler.precacheHandled);
        document.dispatchEvent(
          new CustomEvent('asset:precache-adopted', { detail: result }),
        );
      }
      return result;
    })().finally(() => {
      this.precacheAdoption = null;
    });

    return this.precacheAdoption;
  }

  /**
   * An update finished installing while this page is open. Activate it now and
   * hand over with a single reload, so no worker is ever left waiting across a
   * document load.
   */
  async handoverUpdate(worker) {
    if (this.handedOver) return 'busy';
    this.handedOver = true;

    const activated = await this.skipWaiting(worker);
    if (!activated) {
      this.handedOver = false;
      console.warn('[assets] Updated worker did not activate');
      return 'failed';
    }

    const build = await this.waitForControllerBuildChange();
    if (build) {
      this.reloadForBuild(build);
      return 'reloading';
    }

    return 'activated';
  }

  /**
   * A page newer than its controller means the waiting worker was not activated
   * before this navigation. Try to activate it and reload once so the document
   * and its precache come from the same build. If Chrome refuses (an update
   * that was already waiting when this document loaded), keep running on the
   * old controller instead of reloading into the same state.
   */
  async recoverController(registration, controllerBuild) {
    const waiting = registration.waiting;
    if (!waiting) {
      console.warn(
        `[assets] Page ${this.buildId} is controlled by build ${controllerBuild}`,
      );
      return 'mismatch';
    }

    const activated = await this.skipWaiting(waiting);
    if (!activated) {
      console.warn(
        `[assets] Waiting worker did not activate; continuing on build ${controllerBuild}`,
      );
      return 'mismatch';
    }

    const build = await this.waitForControllerBuildChange();
    if (build) {
      this.reloadForBuild(build);
      return 'reloading';
    }

    return 'activated';
  }

  async fetchManifest() {
    try {
      const url = new URL(MANIFEST_URL, window.location.origin);
      url.searchParams.set('build', this.buildId);
      const response = await fetch(url.href, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`manifest_http_${response.status}`);
      const manifest = await response.json();
      if (
        !manifest ||
        typeof manifest.buildId !== 'string' ||
        !Array.isArray(manifest.assets)
      ) {
        throw new Error('manifest_invalid');
      }
      return manifest;
    } catch (error) {
      console.warn('[assets] Could not read the asset manifest', error);
      return null;
    }
  }

  async cleanupObsolete() {
    try {
      const obsolete = await getMeta('obsoleteAssets', []);
      if (!Array.isArray(obsolete) || obsolete.length === 0) return;

      const cache = await caches.open(ASSET_CACHE);
      for (const entry of obsolete) {
        if (!entry?.url || !entry?.revision) continue;
        const url = new URL(entry.url, window.location.origin);
        url.searchParams.set('__rev', entry.revision);
        await cache.delete(url.href);
      }
      await setMeta('obsoleteAssets', []);
    } catch (error) {
      console.warn('[assets] Could not clean obsolete cache entries', error);
    }
  }

  async writeAssetMap(manifest, precacheHandled) {
    if (!('caches' in window)) return;

    // The scheduler knows exactly which assets the precache is covering, both
    // from bootstrap and from late adoption. Fall back to the old critical
    // heuristic only when the scheduler has not been created yet.
    const precacheIds = this.scheduler?.precacheIds;
    const map = {};
    for (const asset of manifest.assets) {
      const precached = precacheIds
        ? precacheIds.has(asset.id)
        : precacheHandled && asset.critical;
      if (precached) continue;
      map[asset.url] = this.scheduler?.cacheKey(asset) || revisionKey(asset);
    }

    try {
      const cache = await caches.open(META_CACHE);
      await cache.put(
        ASSET_MAP_URL,
        new Response(JSON.stringify({ buildId: manifest.buildId, map }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }),
      );
      navigator.serviceWorker.controller?.postMessage({
        type: 'ASSET_MAP_UPDATED',
      });
    } catch (error) {
      console.warn('[assets] Could not write the asset map', error);
    }
  }

  async handleCommit(manifest) {
    await this.writeAssetMap(
      manifest,
      this.scheduler?.precacheHandled ?? false,
    );
    document.dispatchEvent(
      new CustomEvent('asset:build-committed', {
        detail: { buildId: manifest.buildId },
      }),
    );
  }

  scheduleStart() {
    const run = () => {
      if (this.started) return;
      this.started = true;
      this.scheduler?.startHomepagePhase();
    };

    if (document.readyState === 'complete') whenIdle(run);
    else window.addEventListener('load', () => whenIdle(run), { once: true });
  }

  /** Called by the API client with the server's X-Site-Build header. */
  observeBuild(buildId) {
    if (this.isDev || !this.buildId || !buildId) return;
    if (buildId === this.buildId) return;
    if (this.deployment?.buildId === buildId) return;

    this.deployment = { buildId, detectedAt: Date.now() };
    document.documentElement.dataset.assetDeployment = buildId;
    document.dispatchEvent(
      new CustomEvent('asset:deployment', { detail: this.deployment }),
    );

    // Event-driven, not polling: ask the browser to fetch sw.js now. The new
    // worker activates as soon as it installs and the page hands over once.
    this.registration?.update?.().catch(() => {});
  }

  noteDeployment(_worker, source) {
    if (this.isDev) return;
    const buildId = this.deployment?.buildId || null;
    document.dispatchEvent(
      new CustomEvent('asset:deployment', {
        detail: { buildId, source, detectedAt: Date.now() },
      }),
    );
  }

  prioritizeTrack(trackId) {
    return (
      this.scheduler?.prioritizeTrack(trackId) || {
        cached: false,
        url: null,
        asset: null,
      }
    );
  }

  getPlaybackUrl(url) {
    return this.scheduler?.getPlaybackUrl(url) || url;
  }

  pauseBackground() {
    this.scheduler?.pauseBackground();
  }

  resumeBackground() {
    this.scheduler?.resumeBackground();
  }

  emit(progress) {
    this.progress = progress;
    for (const listener of this.listeners) {
      try {
        listener(progress);
      } catch {
        // A diagnostic listener must never break asset handling.
      }
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getStatus() {
    return {
      buildId: this.buildId,
      isDev: this.isDev,
      supported: this.supported,
      mode: this.mode,
      precacheHandled: this.scheduler?.precacheHandled ?? false,
      deployment: this.deployment,
      mismatch: this.mismatch,
      progress: this.progress,
    };
  }
}

export const assetManager = new AssetManager();
