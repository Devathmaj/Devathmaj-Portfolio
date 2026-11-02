import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Two real Wrangler processes exercise the external local DO binding. Never send email.
const children = [];
const cli = path.resolve('node_modules/wrangler/bin/wrangler.js');
async function start(args, label) {
  const child = spawn(process.execPath, [cli, ...args], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  children.push(child);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} startup timed out`)), 45000);
    const done = (error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
    child.once('error', done);
    child.once('exit', (code) => done(new Error(`${label} exited (${code})`)));
    let tail = '';
    const output = (chunk) => {
      // Never print Wrangler's binding listing or local secret material.
      tail = (tail + chunk.toString()).slice(-4096);
      if (/Ready on https?:/.test(tail)) done();
    };
    child.stdout.on('data', output); child.stderr.on('data', output);
  });
  console.log(`${label}: local process ready`);
}

try {
  await start(['dev', '--config', 'contact-rate-limiter/wrangler.toml', '--local', '--ip=127.0.0.1', '--port=8797', '--compatibility-date=2026-10-30'], 'Limiter');
  await start(['pages', 'dev', '_site', '--ip=127.0.0.1', '--port=8798', '--compatibility-date=2026-10-30', '--do', 'CONTACT_LIMITER=ContactRateLimitShard@portfolio-contact-limiter'], 'Pages');
  const url = 'http://127.0.0.1:8798/api/contact';
  // Wrangler's cross-process registry can lag behind its HTTP ready event.
  let get;
  for (let attempt = 0; attempt < 5; attempt++) {
    get = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (get.status !== 503) break;
    await get.body?.cancel();
    await delay(1000);
  }
  assert.equal(get.status, 200, 'GET session issuance requires working external DO binding');
  const cookie = get.headers.get('Set-Cookie');
  assert.ok(cookie?.includes('HttpOnly')); assert.ok(cookie.includes('Secure'));
  const again = await fetch(url, { headers: { Cookie: cookie.split(';')[0] }, signal: AbortSignal.timeout(10000) });
  assert.equal(again.status, 200); assert.equal(again.headers.get('Set-Cookie'), null);
  const invalid = await fetch(url, { method: 'POST', headers: { Origin: 'http://127.0.0.1:8798', 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
  assert.equal(invalid.status, 400);
  assert.equal((await fetch(url, { method: 'DELETE' })).status, 405);
  console.log('PASS: GET cookie issuance, stable session, IP-limited invalid POST, and method rejection through local Pages + external SQLite DO. No provider calls.');
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
}
