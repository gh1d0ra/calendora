// Prepares a local database for the browser tests (and for trying the app locally):
// one family, "E2E Family", with family code E2ETEST and tablet passcode "e2e-pass".
//   node scripts/e2e-seed.mjs <persistDir>
// Then: npx wrangler dev --persist-to <persistDir>  and use "Wall tablet? Sign in with a family code".
// Safe to run again on the same folder: the family is replaced, nothing else is touched.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const persist = process.argv[2];
if (!persist) { console.error('Usage: node scripts/e2e-seed.mjs <persistDir>'); process.exit(1); }
const FAMILY_CODE = 'E2ETEST';
const PASSCODE = 'e2e-pass';

// Same record format as the Worker's makePasscodeRecord(): pbkdf2$iterations$salt$hash (base64url)
const b64u = buf => Buffer.from(buf).toString('base64url');
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(PASSCODE), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
const record = `pbkdf2$100000$${b64u(salt)}$${b64u(bits)}`;

// The Worker creates its tables on first use; create the families table here so the family can be added.
const sql = `
CREATE TABLE IF NOT EXISTS families (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE, passcode TEXT, epoch INTEGER NOT NULL DEFAULT 1, anylist TEXT, created_at INTEGER NOT NULL);
INSERT OR REPLACE INTO families (id, name, code, passcode, epoch, created_at) VALUES ('fe2e', 'E2E Family', '${FAMILY_CODE}', '${record}', 1, ${Date.now()});
`;
const file = path.join(mkdtempSync(path.join(tmpdir(), 'calendora-seed-')), 'seed.sql');
writeFileSync(file, sql);
const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'calendora', '--local', '--persist-to', persist, '--file', file], { stdio: 'inherit' });
console.log(`Seeded ${persist}: family code ${FAMILY_CODE}, passcode ${PASSCODE}`);
