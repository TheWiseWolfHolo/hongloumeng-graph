// 从原文数出每个人每回被提到几次、同一段里一起出现的人，写进 src/data/derived/。
// 人名识别规则在 src/lib/names.ts。用法 node scripts/build-stats.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findNames } from '../src/lib/names.ts';
import { PEOPLE } from '../src/data/people.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src', 'data', 'derived');
mkdirSync(out, { recursive: true });
const pad = n => String(n).padStart(3, '0');

const mentions = Object.fromEntries(PEOPLE.map(p => [p.id, new Array(120).fill(0)]));
const pairs = new Map();
const firstSeen = {};
for (let n = 1; n <= 120; n++) {
  const d = JSON.parse(readFileSync(join(root, 'src', 'data', 'text', `${pad(n)}.json`), 'utf8'));
  d.blocks.forEach((b, bi) => {
    const hits = findNames(b.s, n);
    const seen = new Set();
    for (const h of hits) {
      mentions[h.id][n - 1]++;
      seen.add(h.id);
      if (!firstSeen[h.id]) firstSeen[h.id] = { n, block: bi, text: b.s.slice(Math.max(0, h.start - 24), h.end + 40) };
    }
    const ids = [...seen].sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = ids[i] + '|' + ids[j];
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  });
}
/* 每人取同段出现最多的前十二位 */
const companions = {};
for (const [k, v] of pairs) {
  const [a, b] = k.split('|');
  (companions[a] ??= []).push([b, v]);
  (companions[b] ??= []).push([a, v]);
}
for (const id in companions) companions[id] = companions[id].sort((x, y) => y[1] - x[1]).slice(0, 12);
const totals = Object.fromEntries(Object.entries(mentions).map(([id, arr]) => [id, arr.reduce((a, b) => a + b, 0)]));
/* 全书前四十条同段关系，给“原文里谁和谁最常一起出现”用 */
const topPairs = [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => [...k.split('|'), v]);
writeFileSync(join(out, 'mentions.json'), JSON.stringify(mentions));
writeFileSync(join(out, 'stats.json'), JSON.stringify({ totals, firstSeen, companions, topPairs }));
const rank = Object.entries(totals).sort((a, b) => b[1] - a[1]);
console.log('提到最多：', rank.slice(0, 25).map(([k, v]) => `${k}${v}`).join(' '));
console.log('一次没提到：', rank.filter(([, v]) => !v).map(([k]) => k).join(' '));
