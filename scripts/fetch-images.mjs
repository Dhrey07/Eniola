#!/usr/bin/env node
/**
 * Downloads the photos from Eniola's Lovable site into public/images/eniola/.
 * Runs automatically before `npm run dev` and `npm run build` (predev/prebuild).
 * Only files still listed in public/images/eniola/placeholders.txt are fetched,
 * so your own replacements are never overwritten. Offline? It warns and the
 * quote cards stay in place.
 *
 * If her Lovable site is re-published, the hashed file names below may
 * change — open the site, copy the new image URLs, and update SOURCES.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://genuine-connections-me.lovable.app/assets/';
const SOURCES = {
  relationships: 'relationships-DvJeItRM.jpg',
  faith: 'faith-DNNWHSf3.jpg',
  career: 'career-CFrruESr.jpg',
  help: 'help-C8m_-a_I.jpg',
  'love-doing': 'love-doing-kKL7IEgV.jpg',
  style: 'style--IUL43q8.jpg',
  gold: 'gold-DL_KY6T6.jpg',
};

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images', 'eniola');
const marker = join(dir, 'placeholders.txt');

const pending = existsSync(marker)
  ? (await readFile(marker, 'utf8')).split('\n').map((s) => s.trim()).filter(Boolean)
  : [];

if (!pending.length) process.exit(0);

const still = [];
for (const name of pending) {
  const file = SOURCES[name];
  if (!file) continue;
  try {
    const res = await fetch(BASE + file, { signal: AbortSignal.timeout(15000) });
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(join(dir, `${name}.jpg`), buf);
    console.log(`  ✓ ${name}.jpg (${Math.round(buf.length / 1024)} KB)`);
  } catch (e) {
    still.push(name);
    console.warn(`  ! ${name}.jpg not downloaded (${e.message}), keeping the quote card`);
  }
}
await writeFile(marker, still.length ? still.join('\n') + '\n' : '');
