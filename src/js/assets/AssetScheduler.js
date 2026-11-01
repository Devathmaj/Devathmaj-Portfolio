import {
  commitBuild,
  getAll,
  getActiveManifest,
  getDownloadQueue,
  getMeta,
  getPendingBuild,
  putQueue,
  stageBuild,
} from './db.js';

const ASSET_CACHE = 'portfolio-assets-v1';
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1500;

const GROUP_LIMITS = {
  homepage: 2,
  other: 2,
  music: 1,
  user: 3,
};

const GROUPS = ['homepage', 'other', 'music', 'user'];
const PHASE_GROUP = {
  homepage: 'homepage',
  background: 'other',
  music: 'music',
};

const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error || 'download_failed');

const backoff = (attempts) =>
  Math.min(30000, RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1));

const sha256Hex = async (buffer) => {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export class AssetScheduler {
  constructor({ buildId, precacheHandled = false, onUpdate = null, onCommit = null } = {}) {
    this.buildId = buildId;
    this.precacheHandled = precacheHandled;
    this.onUpdate = onUpdate;
    this.onCommit = onCommit;

    this.manifest = null;
    this.assets = [];
    this.assetsById = new Map();
    this.assetsByUrl = new Map();
    this.records = new Map();
    this.obsoleteAssets = [];
    this.cachedIds = new Set();
    this.precacheIds = new Set();
    this.failed = new Set();
    this.queues = Object.fromEntries(GROUPS.map((group) => [group, []]));
    this.active = Object.fromEntries(GROUPS.map((group) => [group, 0]));
    this.pumping = Object.fromEntries(GROUPS.map((group) => [group, false]));
    this.queuedIds = new Set();
    this.inflight = new Map();
    this.controllers = new Map();
    this.abortedFor = new Map();
    this.phase = 'idle';
    this.paused = false;
    this.online = navigator.onLine !== false;
    this.saveData = navigator.connection?.saveData === true;
    this.pendingRetries = 0;
    this.resumeTimer = null;
    this.musicSkipped = false;
    this.quotaExceeded = false;
    this.listenersAttached = false;
  }

  get cacheName() {
    return ASSET_CACHE;
  }

  cacheKey(asset) {
    const url = new URL(asset.url, window.location.origin);
    url.searchParams.set('__rev', asset.revision);
    return url.href;
  }

  setManifest(manifest) {
    this.manifest = manifest;
    this.assets = manifest.assets || [];
    this.assetsById = new Map(this.assets.map((asset) => [asset.id, asset]));
    this.assetsByUrl = new Map(this.assets.map((asset) => [asset.url, asset]));
  }

  attachListeners() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    window.addEventListener('online', () => {
      this.online = true;
      this.emit();
      this.requeueAvailable();
    });

    window.addEventListener('offline', () => {
      this.online = false;
      this.emit();
    });

    const connection = navigator.connection;
    connection?.addEventListener?.('change', () => {
      this.saveData = connection.saveData === true;
      this.emit();
      this.pumpAll();
    });
  }

  makeRecord(asset, status = 'pending') {
    return {
      id: asset.id,
      url: asset.url,
      revision: asset.revision,
      type: asset.type,
      priorityGroup: asset.priorityGroup,
      buildId: this.buildId,
      status,
      attempts: 0,
      error: null,
      bytes: 0,
      totalBytes: asset.size,
      updatedAt: Date.now(),
      completedAt: null,
    };
  }

  async ensureRecords() {
    const existing = new Map(
      (await getDownloadQueue())
        .filter((record) => record.buildId === this.buildId)
        .map((record) => [record.id, record]),
    );

    const records = [];
    for (const asset of this.assets) {
      let record = existing.get(asset.id);
      if (!record) {
        record = this.makeRecord(
          asset,
          this.precacheHandled && asset.critical ? 'precache' : 'pending',
        );
      }
      this.records.set(asset.id, record);
      records.push(record);
    }

    if (records.length) await putQueue(records);
  }

  async initialize(manifest, { precacheHandled = this.precacheHandled } = {}) {
    this.precacheHandled = precacheHandled;
    this.setManifest(manifest);
    this.attachListeners();
    await this.ensureRecords();

    const pending = await getPendingBuild();
    this.obsoleteAssets =
      pending?.buildId === this.buildId
        ? await getMeta('pendingObsolete', [])
        : [];

    // A previous session may have exhausted its retries. Completed work is
    // preserved; only failed/retrying records get a fresh set of attempts.
    const resets = [];
    for (const record of this.records.values()) {
      if (record.status === 'failed' || record.status === 'retrying') {
        record.status = 'pending';
        record.attempts = 0;
        record.error = null;
        record.updatedAt = Date.now();
        resets.push(record);
      }
    }
    if (resets.length) await putQueue(resets);

    for (const record of this.records.values()) {
      if (record.status === 'completed') this.cachedIds.add(record.id);
      if (record.status === 'precache') this.precacheIds.add(record.id);
    }

    for (const record of this.records.values()) {
      if (record.status === 'completed' || record.status === 'precache') continue;
      const asset = this.assetsById.get(record.id);
      if (asset) this.enqueue(asset, asset.priorityGroup);
    }

    this.phase = 'idle';
    this.emit();
  }

  async reconcile(manifest, { precacheHandled = this.precacheHandled } = {}) {
    this.precacheHandled = precacheHandled;
    const previous = (await getActiveManifest()) || (await getPendingBuild())?.manifest;
    const previousAssets = previous?.assets || (await getAll('assets'));
    const previousById = new Map(previousAssets.map((asset) => [asset.id, asset]));
    const previousByUrl = new Map(previousAssets.map((asset) => [asset.url, asset]));
    const nextIds = new Set(manifest.assets.map((asset) => asset.id));
    const obsolete = [];

    let unchanged = 0;
    let added = 0;
    let modified = 0;

    const records = [];
    for (const asset of manifest.assets) {
      const old = previousById.get(asset.id) || previousByUrl.get(asset.url);
      const changed = !old || old.revision !== asset.revision;
      if (!old) added += 1;
      else if (changed) {
        modified += 1;
        obsolete.push({ id: old.id, url: old.url, revision: old.revision });
      } else unchanged += 1;

      const status = this.precacheHandled && asset.critical ? 'precache' : 'pending';
      records.push(this.makeRecord(asset, status));
    }

    for (const old of previousAssets) {
      if (!nextIds.has(old.id) && !manifest.assets.some((asset) => asset.url === old.url)) {
        obsolete.push({ id: old.id, url: old.url, revision: old.revision });
      }
    }

    this.setManifest(manifest);
    this.obsoleteAssets = obsolete;
    this.records = new Map(records.map((record) => [record.id, record]));
    this.cachedIds.clear();
    this.precacheIds.clear();
    this.failed.clear();
    this.queuedIds.clear();
    this.queues = Object.fromEntries(GROUPS.map((group) => [group, []]));
    this.phase = 'idle';

    await stageBuild(manifest, records, obsolete);
    this.attachListeners();

    for (const record of records) {
      if (record.status === 'precache') this.precacheIds.add(record.id);
      else {
        const asset = this.assetsById.get(record.id);
        if (asset) this.enqueue(asset, asset.priorityGroup);
      }
    }

    this.emit();
    return { unchanged, added, modified, removed: obsolete.length };
  }

  enqueue(asset, group) {
    if (!asset || !this.queues[group]) return;
    if (this.queuedIds.has(asset.id) || this.cachedIds.has(asset.id) || this.precacheIds.has(asset.id)) {
      return;
    }
    if (this.failed.has(asset.id)) return;
    this.queuedIds.add(asset.id);
    this.queues[group].push(asset);
  }

  enqueueGroup(group) {
    for (const asset of this.assets) {
      if (asset.priorityGroup === group) this.enqueue(asset, group);
    }
  }

  limit(group) {
    const constrained =
      this.saveData ||
      ['slow-2g', '2g'].includes(navigator.connection?.effectiveType || '');
    return constrained ? 1 : GROUP_LIMITS[group];
  }

  async isCached(asset) {
    if (this.cachedIds.has(asset.id)) return true;
    if (!('caches' in window)) return false;
    try {
      const cache = await caches.open(ASSET_CACHE);
      const hit = await cache.match(this.cacheKey(asset));
      if (hit) this.cachedIds.add(asset.id);
      return Boolean(hit);
    } catch {
      return false;
    }
  }

  async pump(group) {
    if (this.pumping[group]) return;
    this.pumping[group] = true;

    try {
      while (true) {
        if (!this.online) break;
        if (this.paused && group !== 'user') break;
        if (this.active[group] >= this.limit(group)) break;

        const asset = this.queues[group].shift();
        if (!asset) break;
        this.queuedIds.delete(asset.id);

        if (this.cachedIds.has(asset.id) || this.precacheIds.has(asset.id)) {
          await this.markCompleted(asset, group, this.records.get(asset.id)?.bytes || asset.size);
          continue;
        }

        if (await this.isCached(asset)) {
          await this.markCompleted(asset, group, asset.size);
          continue;
        }

        this.active[group] += 1;
        this.download(asset, group).finally(() => {
          this.active[group] -= 1;
          this.emit();
          this.pump(group);
          this.maybeAdvance();
        });
      }
    } finally {
      this.pumping[group] = false;
      this.maybeAdvance();
    }
  }

  async download(asset, group) {
    if (this.inflight.has(asset.id)) return this.inflight.get(asset.id);

    const controller = new AbortController();
    const task = (async () => {
      const key = this.cacheKey(asset);
      const response = await fetch(key, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'X-Asset-Download': '1' },
        signal: controller.signal,
      });

      if (response.status === 206) throw new Error('partial_response');
      if (!response.ok) throw new Error(`http_${response.status}`);

      const buffer = await response.arrayBuffer();
      if (asset.size && buffer.byteLength !== asset.size) {
        throw new Error(`size_mismatch:${buffer.byteLength}`);
      }

      if (asset.revision?.startsWith('sha256-')) {
        const digest = await sha256Hex(buffer);
        if (digest && asset.revision !== `sha256-${digest.slice(0, 16)}`) {
          throw new Error('revision_mismatch');
        }
      }

      const cache = await caches.open(ASSET_CACHE);
      await cache.put(
        key,
        new Response(buffer, {
          status: 200,
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Length': String(buffer.byteLength),
          },
        }),
      );

      this.cachedIds.add(asset.id);
      await this.markCompleted(asset, group, buffer.byteLength);
    })().catch(async (error) => {
      if (error?.name === 'AbortError') {
        // Preemption is not a failure: keep the record pending and let the
        // finally block put it back in the right queue.
        const record = this.records.get(asset.id) || this.makeRecord(asset);
        record.status = 'pending';
        record.error = null;
        record.updatedAt = Date.now();
        this.records.set(asset.id, record);
        if (!this.abortedFor.has(asset.id)) {
          this.abortedFor.set(asset.id, group === 'user' ? 'user' : 'background');
        }
        await putQueue([record]);
        this.emit();
        return;
      }
      await this.markFailed(asset, group, error);
    }).finally(() => {
      this.inflight.delete(asset.id);
      this.controllers.delete(asset.id);

      const target = this.abortedFor.get(asset.id);
      if (!target) return;
      this.abortedFor.delete(asset.id);

      if (target === 'user') {
        this.queues.user.unshift(asset);
        this.queuedIds.add(asset.id);
        this.pump('user');
        return;
      }
      this.enqueue(asset, group);
      this.pump(group);
    });

    this.inflight.set(asset.id, task);
    this.controllers.set(asset.id, controller);
    return task;
  }

  async markCompleted(asset, group, bytes) {
    const record = this.records.get(asset.id) || this.makeRecord(asset);
    record.status = 'completed';
    record.bytes = bytes || record.bytes || 0;
    record.error = null;
    record.completedAt = Date.now();
    record.updatedAt = record.completedAt;
    this.records.set(asset.id, record);
    this.cachedIds.add(asset.id);
    await putQueue([record]);
    if (group === 'user') this.scheduleResume();
    this.emit();
  }

  async markFailed(asset, group, error) {
    const record = this.records.get(asset.id) || this.makeRecord(asset);
    const message = errorMessage(error);
    record.attempts += 1;
    record.error = message;
    record.updatedAt = Date.now();

    if (/quota/i.test(message) || error?.name === 'QuotaExceededError') {
      this.quotaExceeded = true;
      this.musicSkipped = true;
      this.paused = true;
      document.dispatchEvent(new CustomEvent('asset:quota-exceeded', { detail: { asset } }));
    }

    if (record.attempts < MAX_ATTEMPTS && this.online) {
      record.status = 'retrying';
      this.records.set(asset.id, record);
      await putQueue([record]);
      this.pendingRetries += 1;
      this.emit();
      window.setTimeout(() => {
        this.pendingRetries = Math.max(0, this.pendingRetries - 1);
        this.queuedIds.delete(asset.id);
        this.enqueue(asset, group);
        this.pump(group);
        this.maybeAdvance();
      }, backoff(record.attempts));
      return;
    }

    record.status = 'failed';
    this.records.set(asset.id, record);
    this.failed.add(asset.id);
    await putQueue([record]);
    if (group === 'user') this.scheduleResume();
    this.emit();
  }

  requeueAvailable() {
    for (const record of this.records.values()) {
      if (record.status === 'completed' || record.status === 'precache') continue;
      if (this.cachedIds.has(record.id) || this.precacheIds.has(record.id)) continue;
      if (this.failed.has(record.id)) continue;
      const asset = this.assetsById.get(record.id);
      if (asset) this.enqueue(asset, asset.priorityGroup);
    }
    this.pumpAll();
  }

  pumpAll() {
    for (const group of GROUPS) this.pump(group);
  }

  startHomepagePhase() {
    if (this.phase === 'complete') return;
    this.phase = 'homepage';
    this.enqueueGroup('homepage');
    this.pump('homepage');
    this.maybeAdvance();
  }

  startBackgroundPhase() {
    if (['background', 'music', 'complete'].includes(this.phase)) return;
    if (this.paused) return;
    this.phase = 'background';
    this.enqueueGroup('other');
    this.pump('other');
    this.maybeAdvance();
  }

  startMusicPhase() {
    if (['music', 'complete'].includes(this.phase)) return;
    if (this.paused) return;
    this.phase = 'music';
    if (this.saveData) {
      this.musicSkipped = true;
      this.emit();
      this.maybeAdvance();
      return;
    }
    this.enqueueGroup('music');
    this.pump('music');
    this.maybeAdvance();
  }

  groupDone(group) {
    return (
      this.queues[group].length === 0 &&
      this.active[group] === 0 &&
      !this.retriesInGroup(group)
    );
  }

  retriesInGroup(group) {
    for (const record of this.records.values()) {
      if (record.status === 'retrying' && record.priorityGroup === group) {
        return true;
      }
    }
    return false;
  }

  failedInGroup(group) {
    return [...this.failed].some((id) => this.assetsById.get(id)?.priorityGroup === group);
  }

  maybeAdvance() {
    if (this.paused || this.phase === 'complete' || this.phase === 'idle') return;

    if (this.phase === 'homepage' && this.groupDone('homepage')) {
      if (this.failedInGroup('homepage')) {
        this.emit();
        return;
      }
      this.startBackgroundPhase();
      return;
    }

    if (this.phase === 'background' && this.groupDone('other')) {
      if (this.failedInGroup('other')) {
        this.emit();
        return;
      }
      this.startMusicPhase();
      return;
    }

    if (this.phase === 'music' && (this.musicSkipped || this.groupDone('music'))) {
      if (this.failedInGroup('music') && !this.musicSkipped) {
        this.emit();
        return;
      }
      this.finishBuild();
    }
  }

  async finishBuild() {
    if (this.phase === 'complete') return;
    this.phase = 'complete';
    try {
      await commitBuild(this.manifest, this.obsoleteAssets);
      await this.onCommit?.(this.manifest);
    } catch (error) {
      console.error('[assets] Could not commit the reconciled build', error);
      this.phase = 'music';
      return;
    }
    this.emit();
  }

  prioritizeAsset(assetId) {
    const asset = this.assetsById.get(assetId);
    if (!asset) return { cached: false, url: null, asset: null };

    this.pauseBackground();

    // A visitor-selected record must not wait behind speculative images. Abort
    // those transfers; they are requeued and resumed later, not failed.
    this.abortBackgroundDownloads(asset.id);

    for (const group of ['homepage', 'other', 'music', 'user']) {
      this.queues[group] = this.queues[group].filter((entry) => entry.id !== assetId);
    }
    this.queuedIds.delete(assetId);

    if (this.cachedIds.has(asset.id) || this.precacheIds.has(asset.id)) {
      this.scheduleResume();
      return { cached: true, url: this.cacheKey(asset), asset };
    }

    if (this.inflight.has(asset.id)) {
      // Already transferring (for example the music prefetch started it). Move
      // the transfer into the user queue so it resumes immediately at full
      // priority instead of waiting for the background phase.
      this.abortedFor.set(asset.id, 'user');
      this.controllers.get(asset.id)?.abort();
      return { cached: false, url: asset.url, asset };
    }

    // An explicit selection deserves a fresh set of attempts even if the
    // background pass gave up on this file earlier.
    this.failed.delete(asset.id);
    const record = this.records.get(asset.id);
    if (record && (record.status === 'failed' || record.status === 'retrying')) {
      record.status = 'pending';
      record.attempts = 0;
      record.error = null;
    }

    this.queues.user.unshift(asset);
    this.queuedIds.add(assetId);
    this.pump('user');

    // Do not resume the speculative queues until this download finishes.
    // markCompleted/markFailed call scheduleResume for the user group.
    return { cached: false, url: asset.url, asset };
  }

  abortBackgroundDownloads(exceptId = null) {
    for (const [id, controller] of this.controllers) {
      if (id === exceptId) continue;
      const group = this.records.get(id)?.priorityGroup;
      if (group && group !== 'user') controller.abort();
    }
  }

  prioritizeTrack(trackId) {
    const track = this.manifest?.music?.find((entry) => entry.id === trackId);
    if (!track) return { cached: false, url: null, asset: null };

    const asset =
      this.assetsById.get(track.assetId) ||
      this.assetsByUrl.get(track.audioUrl);
    const result = asset
      ? this.prioritizeAsset(asset.id)
      : { cached: false, url: track.audioUrl, asset: null };

    if (track.artworkUrl) {
      const artwork = this.assetsByUrl.get(track.artworkUrl);
      if (artwork) this.prioritizeAsset(artwork.id);
    }

    return result;
  }

  getPlaybackUrl(url) {
    const asset = this.assetsByUrl.get(new URL(url, window.location.origin).pathname);
    if (!asset) return url;
    if (this.cachedIds.has(asset.id) || this.precacheIds.has(asset.id)) {
      return this.cacheKey(asset);
    }
    return url;
  }

  isCachedSync(assetId) {
    return this.cachedIds.has(assetId) || this.precacheIds.has(assetId);
  }

  pauseBackground() {
    this.paused = true;
    this.emit();
  }

  resumeBackground() {
    if (this.resumeTimer) {
      window.clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
    this.paused = false;
    this.emit();
    this.pumpAll();
    this.maybeAdvance();
  }

  scheduleResume() {
    if (this.resumeTimer) window.clearTimeout(this.resumeTimer);
    this.resumeTimer = window.setTimeout(() => {
      if (this.active.user === 0 && this.queues.user.length === 0) {
        this.resumeBackground();
      }
    }, 1200);
  }

  getQueueStatus() {
    return {
      phase: this.phase,
      paused: this.paused,
      online: this.online,
      saveData: this.saveData,
      pendingRetries: this.pendingRetries,
      inflight: this.inflight.size,
      queues: Object.fromEntries(
        GROUPS.map((group) => [
          group,
          {
            queued: this.queues[group].length,
            active: this.active[group],
            limit: this.limit(group),
          },
        ]),
      ),
    };
  }

  getProgress() {
    const groups = {};
    for (const group of ['homepage', 'other', 'music']) {
      const assets = this.assets.filter((asset) => asset.priorityGroup === group);
      let completed = 0;
      let failed = 0;
      let bytes = 0;
      let totalBytes = 0;
      for (const asset of assets) {
        totalBytes += asset.size;
        const record = this.records.get(asset.id);
        if (record?.status === 'completed' || record?.status === 'precache' || this.cachedIds.has(asset.id)) {
          completed += 1;
          bytes += record?.bytes || asset.size;
        } else if (record?.status === 'failed' || this.failed.has(asset.id)) {
          failed += 1;
        }
      }
      groups[group] = {
        total: assets.length,
        completed,
        failed,
        bytes,
        totalBytes,
      };
    }

    return {
      buildId: this.buildId,
      phase: this.phase,
      paused: this.paused,
      online: this.online,
      groups,
      queue: this.getQueueStatus(),
    };
  }

  emit() {
    const progress = this.getProgress();
    this.onUpdate?.(progress);
    document.dispatchEvent(new CustomEvent('asset:progress', { detail: progress }));
  }
}

export { ASSET_CACHE, MAX_ATTEMPTS, GROUP_LIMITS };
