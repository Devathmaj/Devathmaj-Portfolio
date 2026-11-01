const DB_NAME = 'portfolio-library';
const DB_VERSION = 1;

let dbPromise = null;

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const transactionDone = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction_aborted'));
  });

const ensureStore = (db, upgradeTransaction, name, options) => {
  if (db.objectStoreNames.contains(name)) return upgradeTransaction.objectStore(name);
  return db.createObjectStore(name, options);
};

const ensureIndex = (store, name, keyPath, options = {}) => {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options);
};

export function openLibrary() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('indexeddb_unavailable'));
      return;
    }

    const open = indexedDB.open(DB_NAME, DB_VERSION);

    open.onupgradeneeded = () => {
      const db = open.result;
      const upgradeTransaction = open.transaction;
      const tracks = ensureStore(db, upgradeTransaction, 'tracks', { keyPath: 'id' });
      ensureIndex(tracks, 'title', 'title');
      ensureIndex(tracks, 'artist', 'artist');
      ensureIndex(tracks, 'album', 'album');
      ensureIndex(tracks, 'genre', 'genre');

      const albums = ensureStore(db, upgradeTransaction, 'albums', { keyPath: 'id' });
      ensureIndex(albums, 'title', 'title');
      ensureIndex(albums, 'artist', 'artist');

      const artists = ensureStore(db, upgradeTransaction, 'artists', { keyPath: 'id' });
      ensureIndex(artists, 'name', 'name');

      const playlists = ensureStore(db, upgradeTransaction, 'playlists', { keyPath: 'id' });
      ensureIndex(playlists, 'title', 'title');

      const assets = ensureStore(db, upgradeTransaction, 'assets', { keyPath: 'id' });
      ensureIndex(assets, 'url', 'url');
      ensureIndex(assets, 'type', 'type');
      ensureIndex(assets, 'revision', 'revision');
      ensureIndex(assets, 'priorityGroup', 'priorityGroup');

      const meta = ensureStore(db, upgradeTransaction, 'meta', { keyPath: 'key' });

      const queue = ensureStore(db, upgradeTransaction, 'downloadQueue', { keyPath: 'id' });
      ensureIndex(queue, 'status', 'status');
      ensureIndex(queue, 'priorityGroup', 'priorityGroup');
      ensureIndex(queue, 'revision', 'revision');
      ensureIndex(queue, 'updatedAt', 'updatedAt');

      // Keep schema migration independent from the website build identifier.
      meta.put({ key: 'schemaVersion', value: DB_VERSION });
    };

    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => {
      console.warn('[assets] IndexedDB upgrade blocked by another tab');
    };
  });

  return dbPromise;
}

export async function getMeta(key, fallback = null) {
  const db = await openLibrary();
  const tx = db.transaction('meta', 'readonly');
  const result = await request(tx.objectStore('meta').get(key));
  return result ? result.value : fallback;
}

export async function setMeta(key, value) {
  const db = await openLibrary();
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ key, value });
  await transactionDone(tx);
}

export async function getAll(storeName) {
  const db = await openLibrary();
  const tx = db.transaction(storeName, 'readonly');
  return request(tx.objectStore(storeName).getAll());
}

export async function putAll(storeName, records) {
  const db = await openLibrary();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const record of records) store.put(record);
  await transactionDone(tx);
}

export async function clearStore(storeName) {
  const db = await openLibrary();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
  await transactionDone(tx);
}

export async function putQueue(records) {
  if (!records.length) return;
  await putAll('downloadQueue', records);
}

export async function deleteQueue(ids) {
  if (!ids.length) return;
  const db = await openLibrary();
  const tx = db.transaction('downloadQueue', 'readwrite');
  const store = tx.objectStore('downloadQueue');
  for (const id of ids) store.delete(id);
  await transactionDone(tx);
}

const slug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';

const catalogueRecords = (manifest) => {
  const tracks = [];
  const albums = new Map();
  const artists = new Map();

  for (const track of manifest.music || []) {
    tracks.push({
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre,
      duration: track.duration ?? null,
      colour: track.colour,
      assetId: track.assetId,
      audioUrl: track.audioUrl,
      artworkUrl: track.artworkUrl,
      sources: track.sources,
    });

    if (track.album) {
      albums.set(slug(track.album), {
        id: slug(track.album),
        title: track.album,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
      });
    }
    if (track.artist) {
      artists.set(slug(track.artist), { id: slug(track.artist), name: track.artist });
    }
  }

  return {
    tracks,
    albums: [...albums.values()],
    artists: [...artists.values()],
    playlists: [
      {
        id: 'the-listening-room',
        title: 'The Listening Room',
        trackIds: tracks.map((track) => track.id),
      },
    ],
  };
};

/**
 * Commit a fully reconciled build in one transaction. Until this runs the
 * previous active build and its catalogue remain the source of truth.
 */
export async function commitBuild(manifest, obsoleteAssets = []) {
  const db = await openLibrary();
  const catalogue = catalogueRecords(manifest);
  const tx = db.transaction(
    ['assets', 'tracks', 'albums', 'artists', 'playlists', 'meta'],
    'readwrite',
  );

  const assets = tx.objectStore('assets');
  assets.clear();
  for (const asset of manifest.assets) assets.put(asset);

  for (const [storeName, records] of [
    ['tracks', catalogue.tracks],
    ['albums', catalogue.albums],
    ['artists', catalogue.artists],
    ['playlists', catalogue.playlists],
  ]) {
    const store = tx.objectStore(storeName);
    store.clear();
    for (const record of records) store.put(record);
  }

  const meta = tx.objectStore('meta');
  meta.put({ key: 'activeBuildId', value: manifest.buildId });
  meta.put({ key: 'activeManifest', value: manifest });
  meta.put({ key: 'catalogueRevision', value: manifest.buildId });
  meta.put({ key: 'lastReconciledAt', value: Date.now() });
  meta.put({ key: 'obsoleteAssets', value: obsoleteAssets });
  meta.delete('pendingBuild');
  meta.delete('pendingObsolete');

  await transactionDone(tx);
}

export async function stageBuild(manifest, queueRecords, obsoleteAssets = []) {
  const db = await openLibrary();
  const tx = db.transaction(['meta', 'downloadQueue'], 'readwrite');
  const meta = tx.objectStore('meta');
  const queue = tx.objectStore('downloadQueue');

  queue.clear();
  for (const record of queueRecords) queue.put(record);

  meta.put({ key: 'pendingBuild', value: { buildId: manifest.buildId, manifest } });
  meta.put({ key: 'pendingObsolete', value: obsoleteAssets });

  await transactionDone(tx);
}

/**
 * Flag asset rows that are backed by the service worker precache. The assets
 * store is a projection of the manifest, so only rows matching the same
 * revision are touched; rows from an older build are left alone.
 */
export async function markAssetsAdopted(assets) {
  if (!assets?.length) return;
  const revisions = new Map(assets.map((asset) => [asset.id, asset.revision]));
  const rows = await getAll('assets');
  const updates = [];
  for (const row of rows) {
    if (revisions.get(row.id) !== row.revision) continue;
    if (row.adopted === true) continue;
    updates.push({ ...row, adopted: true });
  }
  if (updates.length) await putAll('assets', updates);
}

export async function getActiveManifest() {
  return getMeta('activeManifest', null);
}

export async function getPendingBuild() {
  return getMeta('pendingBuild', null);
}

export async function getActiveBuildId() {
  return getMeta('activeBuildId', null);
}

export async function getDownloadQueue() {
  return getAll('downloadQueue');
}

export async function getCatalogue() {
  return {
    tracks: await getAll('tracks'),
    albums: await getAll('albums'),
    artists: await getAll('artists'),
    playlists: await getAll('playlists'),
  };
}

export { DB_NAME, DB_VERSION };
