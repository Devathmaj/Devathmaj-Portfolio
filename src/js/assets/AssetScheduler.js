import {
  commitBuild,
  getAll,
  getActiveManifest,
  getDownloadQueue,
  getMeta,
  getPendingBuild,
  markAssetsAdopted,
  putQueue,
  stageBuild,
} from './db.js';

const ASSET_CACHE = 'portfolio-assets-v1';
const PRECACHE_CACHE_PREFIX = 'workbox-precache';
const PRECACHE_LOOKUP_RETRY_MS = 5000;
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
    this.precacheCacheName = null;
    this.precacheLookupAt = 0;
    this.adoption = null;
  }

  get cacheName() {
    return ASSET_CACHE;
  }

  cacheKey(asset) {
    const url = new URL(asset.url, window.location.origin);
    url.searchParams.set('__rev', asset.revision);
    return url.href;
  }

  /** Workbox stores precache entries under the same URL with its own param. */
  precacheKey(asset) {
    const url = new URL(asset.url, window.location.origin);
    url.searchParams.set('__WB_REVISION__', asset.revision);
    return url.href;
  }

  /**
   * Open the Workbox precache for this scope. The name is discovered rather
   * than assumed so a Workbox version bump cannot silently disable adoption.
   */
  async openPrecache({ force = false } = {}) {
    if (!('caches' in window)) return null;

    if (this.precacheCacheName) {
      try {
        if (await caches.has(this.precacheCacheName)) {
          return await caches.open(this.precacheCacheName);
        }
      } catch {
        // Fall through and rediscover the cache.
      }
      this.precacheCacheName = null;
    }

    // Avoid enumerating caches for every asset while the worker is still
    // installing. A controllerchange or a later adoption pass forces a retry.
    if (!force && Date.now() - this.precacheLookupAt < PRECACHE_LOOKUP_RETRY_MS) {
      return null;
    }
    this.precacheLookupAt = Date.now();

    try {
      const names = (await caches.keys()).filter((name) =>
        name.startsWith(PRECACHE_CACHE_PREFIX),
      );
      if (!names.length) return null;

      let name = names[0];
      try {
        const registration = await navigator.serviceWorker?.getRegistration?.();
        if (registration?.scope) {
          const scoped = names.find((candidate) => candidate.endsWith(registration.scope));
          if (scoped) name = scoped;
        }
      } catch {
        // A scope lookup failure only costs us cache-name preference.
      }

      this.precacheCacheName = name;
      return await caches.open(name);
    } catch {
      return null;
    }
  }

  /** Find the precache entry for an asset without ever creating a cache. */
  async matchPrecache(cache, asset) {
    const direct = await cache.match(this.precacheKey(asset));
    if (direct) return direct;

    // Workbox omits the revision for entries it treats as immutable. Match by
    // pathname as a fallback, but never accept a different revision.
    const target = new URL(asset.url, window.location.origin);
    for (const request of await cache.keys()) {
      const url = new URL(request.url);
      if (url.origin !== target.origin || url.pathname !== target.pathname) continue;
      const revision = url.searchParams.get('__WB_REVISION__');
      if (revision && revision !== asset.revision) continue;
      const response = await cache.match(request);
      if (response) return response;
    }
    return null;
  }

  /**
   * Prove the precache copy is the asset this build expects before anything is
   * deleted. Size and revision both come from the build-time manifest.
   */
  async verifyPrecache(asset, response) {
    if (!response || response.status !== 200) return false;
    if (!asset.size) return true;

    try {
      const buffer = await response.clone().arrayBuffer();
      if (buffer.byteLength !== asset.size) return false;
      if (asset.revision?.startsWith('sha256-')) {
        const digest = await sha256Hex(buffer);
        if (digest && asset.revision !== `sha256-${digest.slice(0, 16)}`) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Remove the fallback copy only after the precache copy has been verified. */
  async deleteRegularCopy(asset) {
    this.cachedIds.delete(asset.id);
    try {
      const cache = await caches.open(ASSET_CACHE);
      await cache.delete(this.cacheKey(asset));
    } catch {
      // A missing cache or entry is not an adoption failure.
    }
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
        continue;
      }
      if (record.adopted && !this.precacheHandled) {
        // The precache cannot be confirmed for this session (no matching
        // controller yet), so fall back to a normal download. Late adoption
        // reclaims it as soon as the worker takes over.
        record.status = 'pending';
        record.adopted = false;
        record.updatedAt = Date.now();
        resets.push(record);
      }
    }
    if (resets.length) await putQueue(resets);

    for (const record of this.records.values()) {
      if (record.status === 'precache') this.precacheIds.add(record.id);
      else if (record.status === 'completed') {
        if (record.adopted) this.precacheIds.add(record.id);
        else this.cachedIds.add(record.id);
      }
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

  /**
   * Check both places an asset can live before issuing a request. The precache
   * only ever contains critical assets, so non-critical downloads skip it.
   */
  async findCached(asset) {
    if (this.precacheIds.has(asset.id)) return { kind: 'precache', response: null };
    if (await this.isCached(asset)) return { kind: 'regular' };
    if (!asset.critical) return null;

    try {
      const precache = await this.openPrecache();
      if (!precache) return null;
      const response = await this.matchPrecache(precache, asset);
      if (response) return { kind: 'precache', response };
    } catch {
      // An unreadable precache is treated as a miss.
    }
    return null;
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

        const found = await this.findCached(asset);
        if (found?.kind === 'regular') {
          await this.markCompleted(asset, group, asset.size);
          continue;
        }
        if (found?.kind === 'precache') {
          if (!found.response) {
            await this.markAdopted(asset, group);
            continue;
          }
          if (await this.adoptAsset(asset, group, found.response)) continue;
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

    // Adoption can finish between the pump check and this call.
    if (this.cachedIds.has(asset.id)) {
      await this.markCompleted(asset, group, this.records.get(asset.id)?.bytes || asset.size);
      return;
    }
    if (this.precacheIds.has(asset.id)) {
      await this.markAdopted(asset, group);
      return;
    }

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
        if (this.precacheIds.has(asset.id)) {
          // Adoption claimed this asset before aborting it. The verified
          // precache copy is the source of truth, so keep the record pending
          // here and let adoption mark it complete; never requeue it.
          this.abortedFor.delete(asset.id);
          return;
        }
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
    if (this.precacheIds.has(asset.id)) {
      // Adoption claimed this asset while the regular check was in flight.
      record.adopted = true;
      this.cachedIds.delete(asset.id);
    } else {
      this.cachedIds.add(asset.id);
    }
    await putQueue([record]);
    if (group === 'user') this.scheduleResume();
    this.emit();
  }

  /** Record an asset whose verified copy now lives in the Workbox precache. */
  markAdoptedRecord(asset) {
    const record = this.records.get(asset.id) || this.makeRecord(asset);
    record.status = 'completed';
    record.adopted = true;
    record.bytes = record.bytes || asset.size || 0;
    record.error = null;
    record.completedAt = Date.now();
    record.updatedAt = record.completedAt;
    this.records.set(asset.id, record);
    this.precacheIds.add(asset.id);
    this.cachedIds.delete(asset.id);
    this.failed.delete(asset.id);
    return record;
  }

  async markAdopted(asset, group) {
    const record = this.markAdoptedRecord(asset);
    await putQueue([record]);
    if (group === 'user') this.scheduleResume();
    this.emit();
  }

  /**
   * Adopt one asset discovered during a normal cache check. The precache copy
   * is verified first, so the regular fallback is never removed on a guess.
   */
  async adoptAsset(asset, group, response) {
    if (!(await this.verifyPrecache(asset, response))) return false;

    // Claim the asset before deleting anything: if a later step fails, the
    // verified precache copy remains the source of truth.
    this.precacheIds.add(asset.id);
    this.queuedIds.delete(asset.id);
    for (const name of GROUPS) {
      this.queues[name] = this.queues[name].filter((entry) => entry.id !== asset.id);
    }

    await this.deleteRegularCopy(asset);
    await this.markAdopted(asset, group);
    try {
      await markAssetsAdopted([asset]);
    } catch (error) {
      console.warn('[assets] Could not flag an adopted asset', error);
    }
    return true;
  }

  /** Adopt every critical asset the worker has already precached. */
  async adoptPrecache() {
    if (this.adoption) return this.adoption;
    this.adoption = this.runAdoption().finally(() => {
      this.adoption = null;
    });
    return this.adoption;
  }

  async runAdoption() {
    const critical = this.assets.filter((asset) => asset.critical);
    const result = { inspected: 0, verified: 0, adopted: 0, skipped: 0, missing: 0 };
    if (!critical.length || !('caches' in window)) return result;

    const cache = await this.openPrecache({ force: true });
    if (!cache) return result;

    const candidates = [];
    for (const asset of critical) {
      result.inspected += 1;
      const record = this.records.get(asset.id);
      if (record?.adopted && this.precacheIds.has(asset.id)) {
        result.skipped += 1;
        continue;
      }

      const response = await this.matchPrecache(cache, asset);
      if (!response || !(await this.verifyPrecache(asset, response))) {
        result.missing += 1;
        continue;
      }

      result.verified += 1;
      candidates.push(asset);
    }

    const before = this.precacheHandled;

    if (candidates.length) {
      const ids = new Set(candidates.map((asset) => asset.id));

      // Stop fallback work before waiting on anything. Claiming the ids here
      // also stops an aborted transfer from re-enqueueing them when it unwinds.
      for (const id of ids) {
        this.precacheIds.add(id);
        this.queuedIds.delete(id);
      }
      for (const group of GROUPS) {
        this.queues[group] = this.queues[group].filter((asset) => !ids.has(asset.id));
      }

      const inflight = [];
      for (const id of ids) {
        const controller = this.controllers.get(id);
        if (!controller) continue;
        controller.abort();
        const task = this.inflight.get(id);
        if (task) inflight.push(task);
      }
      if (inflight.length) await Promise.allSettled(inflight);

      const adoptedRecords = [];
      for (const asset of candidates) {
        await this.deleteRegularCopy(asset);
        adoptedRecords.push(this.markAdoptedRecord(asset));
        result.adopted += 1;
      }
      if (adoptedRecords.length) await putQueue(adoptedRecords);

      try {
        await markAssetsAdopted(candidates);
      } catch (error) {
        console.warn('[assets] Could not flag adopted assets', error);
      }
    }

    this.updatePrecacheHandled(critical.length);
    if (result.adopted > 0 || before !== this.precacheHandled) this.emit();
    if (result.adopted > 0) this.maybeAdvance();
    return result;
  }

  /** The precache is "handled" only when every critical asset is covered. */
  updatePrecacheHandled(total = this.assets.filter((asset) => asset.critical).length) {
    if (!total) {
      this.precacheHandled = false;
      return false;
    }

    let covered = 0;
    for (const asset of this.assets) {
      if (asset.critical && this.precacheIds.has(asset.id)) covered += 1;
    }
    this.precacheHandled = covered >= total;
    return this.precacheHandled;
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
