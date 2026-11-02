import { BUCKET_POLICIES, CONTACT_CONFIG } from '../../lib/contact-config.js';
import { readJson } from '../../functions/_shared/contact-validation.js';

export class ContactRateLimitShard {
  constructor(ctx) {
    this.storage = ctx.storage;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS buckets (
      key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
    )`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS buckets_expiry ON buckets(expires_at)');
  }

  async fetch(request) {
    if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    if (new URL(request.url).pathname !== '/consume') return Response.json({ error: 'not_found' }, { status: 404 });
    let payload;
    try {
      payload = await readJson(request, 256);
      if (!payload || Object.keys(payload).length !== 1 || typeof payload.key !== 'string' ||
          !/^(ip|session|init):[a-f0-9]{64}$/.test(payload.key)) throw new Error();
    } catch {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }
    try {
      // Install the alarm before writing a bucket. Failed scheduling fails closed.
      if (await this.storage.getAlarm() === null) await this.storage.setAlarm(Date.now() + CONTACT_CONFIG.CLEANUP_INTERVAL_MS);
      const { limit, windowMs } = BUCKET_POLICIES[payload.key.split(':')[0]];
      const result = this.storage.transactionSync(() => {
        const now = Date.now();
        const row = this.sql.exec('SELECT count, expires_at FROM buckets WHERE key = ?', payload.key).toArray()[0];
        if (!row || row.expires_at <= now) {
          this.sql.exec('INSERT OR REPLACE INTO buckets (key, count, expires_at) VALUES (?, 1, ?)', payload.key, now + windowMs);
          return { allowed: true };
        }
        if (row.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.expires_at - now) / 1000)) };
        this.sql.exec('UPDATE buckets SET count = count + 1 WHERE key = ?', payload.key);
        return { allowed: true };
      });
      return Response.json(result, { status: result.allowed ? 200 : 429 });
    } catch {
      return Response.json({ error: 'temporarily_unavailable' }, { status: 503 });
    }
  }

  async alarm() {
    // Indexed, bounded deletion; no cleanup on the hot request path.
    this.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM buckets WHERE key IN (SELECT key FROM buckets WHERE expires_at <= ? ORDER BY expires_at LIMIT ?)', Date.now(), CONTACT_CONFIG.CLEANUP_BATCH);
    });
    const next = this.sql.exec('SELECT expires_at FROM buckets ORDER BY expires_at LIMIT 1').toArray()[0];
    if (next) await this.storage.setAlarm(Math.max(Date.now() + 1000, next.expires_at));
  }
}

export default { fetch: () => Response.json({ error: 'not_found' }, { status: 404 }) };
