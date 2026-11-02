import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

const path = '.dev.vars';
const existing = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const values = dotenv.parse(existing);
const additions = [];
for (const key of ['CONTACT_SESSION_SECRET', 'CONTACT_RATE_LIMIT_SECRET']) {
  if (!Object.hasOwn(values, key)) additions.push(`${key}=${randomBytes(32).toString('hex')}`);
}
if (!Object.hasOwn(values, 'CONTACT_LOCAL_DEV')) additions.push('CONTACT_LOCAL_DEV=true');
if (additions.length) fs.appendFileSync(path, `\n${additions.join('\n')}\n`, { mode: 0o600 });
console.log(`Local contact setup: appended ${additions.length} missing values; existing values preserved. No secrets displayed.`);
