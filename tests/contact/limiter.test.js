import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CONTACT_CONFIG } from '../../lib/contact-config.js';

// Use Wrangler's own local Workers runtime/bundler; no extra test dependencies.
const require = createRequire(import.meta.resolve('wrangler'));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const { build } = require('esbuild');
let mf;
let namespace;
let serial = 0;
const key = (scope, number = 1) => `${scope}:${number.toString(16).padStart(64, '0')}`;
const consume = (stub, bucket) => stub.fetch('https://limiter/consume', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: bucket }),
});
const inspect = async (stub, operation, args = {}) => (await stub.fetch(`https://limiter/${operation}`, {
  method: 'POST', body: JSON.stringify(args),
})).json();
const shard = () => namespace.get(namespace.idFromName(`test-${serial++}`));

before(async () => {
  const bundle = await build({
    stdin: {
      contents: `import { ContactRateLimitShard } from './contact-rate-limiter/src/index.js';
        export class TestShard extends ContactRateLimitShard {
          async fetch(request) {
            const path = new URL(request.url).pathname;
            if (path === '/expire') {
              const { key } = await request.json();
              this.sql.exec('UPDATE buckets SET expires_at = ? WHERE key = ?', Date.now() - 1, key);
              return Response.json({ ok: true });
            }
            if (path === '/rows') return Response.json(this.sql.exec('SELECT * FROM buckets').toArray());
            if (path === '/cleanup') { await this.alarm(); return Response.json({ ok: true }); }
            if (path === '/break') { this.sql.exec('DROP TABLE buckets'); return Response.json({ ok: true }); }
            return super.fetch(request);
          }
        }
        export { default } from './contact-rate-limiter/src/index.js';`,
      resolveDir: process.cwd(),
    }, bundle: true, format: 'esm', platform: 'neutral', write: false,
  });
  // Bundled workerd supports October 30; keep the production date unchanged.
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-30',
    durableObjects: { CONTACT_LIMITER: { className: 'TestShard', useSQLite: true } } }));
  namespace = await mf.getDurableObjectNamespace('CONTACT_LIMITER');
});
after(async () => { await mf?.dispose(); });

test('IP permits exactly 60 requests; independent IP remains allowed', async () => {
  const stub = shard();
  for (let i = 0; i < CONTACT_CONFIG.CONTACT_IP_LIMIT; i++) assert.equal((await consume(stub, key('ip'))).status, 200);
  const rejected = await consume(stub, key('ip'));
  assert.equal(rejected.status, 429);
  assert.ok((await rejected.json()).retryAfter > 0);
  assert.equal((await consume(stub, key('ip', 2))).status, 200);
});

test('fixed window remains anchored and resets at expiration', async () => {
  const stub = shard();
  await consume(stub, key('ip'));
  await inspect(stub, 'expire', { key: key('ip') });
  assert.equal((await consume(stub, key('ip'))).status, 200);
  assert.equal((await inspect(stub, 'rows'))[0].count, 1);
  const sessionStub = shard();
  await consume(sessionStub, key('session'));
  const first = (await inspect(sessionStub, 'rows'))[0];
  await consume(sessionStub, key('session'));
  assert.equal((await inspect(sessionStub, 'rows'))[0].expires_at, first.expires_at);
  await inspect(sessionStub, 'expire', { key: key('session') });
  assert.equal((await consume(sessionStub, key('session'))).status, 200);
  const reset = (await inspect(sessionStub, 'rows'))[0];
  assert.equal(reset.count, 1);
  assert.ok(reset.expires_at > Date.now());
});

test('three submissions allowed, fourth rejected; shared IP has independent sessions', async () => {
  const stub = shard();
  for (let i = 0; i < 3; i++) {
    assert.equal((await consume(stub, key('ip'))).status, 200);
    assert.equal((await consume(stub, key('session'))).status, 200);
  }
  assert.equal((await consume(stub, key('session'))).status, 429);
  assert.equal((await consume(stub, key('ip'))).status, 200);
  assert.equal((await consume(stub, key('session', 2))).status, 200);
});

test('concurrent SQLite requests cannot exceed a session quota', async () => {
  const stub = shard();
  const results = await Promise.all(Array.from({ length: 30 }, () => consume(stub, key('session'))));
  assert.equal(results.filter((r) => r.status === 200).length, 3);
  assert.equal(results.filter((r) => r.status === 429).length, 27);
  assert.equal((await inspect(stub, 'rows'))[0].count, 3);
});

test('alarm deletes expired rows and preserves live buckets', async () => {
  const stub = shard();
  await consume(stub, key('ip'));
  await consume(stub, key('session'));
  await inspect(stub, 'expire', { key: key('ip') });
  await inspect(stub, 'cleanup');
  assert.deepEqual((await inspect(stub, 'rows')).map((r) => r.key), [key('session')]);
});

test('storage failure returns 503', async () => {
  const stub = shard();
  await inspect(stub, 'break');
  assert.equal((await consume(stub, key('ip'))).status, 503);
});

test('internal endpoint rejects raw identifiers and malformed parameters; public Worker is closed', async () => {
  const stub = shard();
  assert.equal((await stub.fetch('https://limiter/consume')).status, 405);
  for (const value of ['192.0.2.10', 'session:raw', 'unknown:' + 'a'.repeat(64)]) assert.equal((await consume(stub, value)).status, 400);
  assert.equal((await mf.dispatchFetch('https://public.example/consume', { method: 'POST' })).status, 404);
});
