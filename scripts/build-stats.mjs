// 从原文数出每个人每回被提到几次、同一段里一起出现的人，写进 src/data/derived/。
// 前八十回是曹雪芹原作，“提到多少次”“常和谁在一处”都按前八十回算；续书四十回的次数另记。
// 脂批里点到某人的批语也收起来，人物页上用。人名识别规则在 src/lib/names.ts。
// 用法 node scripts/build-stats.mjs
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
const notesOf = {};
/* 真正的脂评出自甲戌、己卯、庚辰三本，蒙府、戚序本的批语多是后人所加，排在后面 */
const RANK = { 甲戌: 3, 庚辰: 3, 己卯: 3, 靖藏: 1, 蒙府: 0, 戚序: 0 };
/* 偏向短而专指这个人的批语：长篇总批点到的人太多，分数按人数摊薄 */
const noteScore = (x, people) => {
  const len = x.s.length;
  const lenScore = len <= 100 ? Math.min(len, 60) / 15 : Math.max(-4, 4 - (len - 100) / 50);
  return Math.max(0, ...x.src.map(s => RANK[s] ?? 1)) * 10 + (x.kind === '眉批' ? 2 : 0) + lenScore + 6 / people;
};

for (let n = 1; n <= 120; n++) {
  const d = JSON.parse(readFileSync(join(root, 'src', 'data', 'text', `${pad(n)}.json`), 'utf8'));
  d.blocks.forEach((b, bi) => {
    if (b.t === 'pi') {
      collectNote(n, bi, b, '');
      return;
    }
    for (const x of b.n ?? []) collectNote(n, bi, x, b.s.slice(Math.max(0, x.at - 22), x.at));
    const hits = findNames(b.s, n);
    const seen = new Set();
    for (const h of hits) {
      mentions[h.id][n - 1]++;
      seen.add(h.id);
      if (!firstSeen[h.id]) firstSeen[h.id] = { n, block: bi, text: b.s.slice(Math.max(0, h.start - 24), h.end + 40) };
    }
    if (n > 80) return;
    const ids = [...seen].sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = ids[i] + '|' + ids[j];
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  });
}

/* 批语里点到谁，就记到谁名下；太短的“妙”“好”不收 */
function collectNote(n, block, x, ctx) {
  if (x.s.length < 6) return;
  const ids = new Set(findNames(x.s, n).map(h => h.id));
  for (const id of ids) {
    (notesOf[id] ??= []).push({ n, block, src: x.src, kind: x.kind, s: x.s, ctx, score: noteScore(x, ids.size) });
  }
}
for (const id in notesOf) {
  const list = notesOf[id].sort((a, b) => b.score - a.score);
  const picked = [];
  /* 同一回最多取两条，免得全挤在一回里 */
  const perCh = {};
  for (const x of list) {
    if ((perCh[x.n] ?? 0) >= 2) continue;
    perCh[x.n] = (perCh[x.n] ?? 0) + 1;
    picked.push(x);
    if (picked.length >= 10) break;
  }
  notesOf[id] = { total: list.length, top: picked.sort((a, b) => a.n - b.n || a.block - b.block).map(({ score, ...x }) => x) };
}

/* 每人取前八十回里同段出现最多的前十二位 */
const companions = {};
for (const [k, v] of pairs) {
  const [a, b] = k.split('|');
  (companions[a] ??= []).push([b, v]);
  (companions[b] ??= []).push([a, v]);
}
for (const id in companions) companions[id] = companions[id].sort((x, y) => y[1] - x[1]).slice(0, 12);
const sum = (arr, a, b) => arr.slice(a, b).reduce((x, y) => x + y, 0);
const totals = Object.fromEntries(Object.entries(mentions).map(([id, arr]) => [id, sum(arr, 0, 80)]));
const sequel = Object.fromEntries(Object.entries(mentions).map(([id, arr]) => [id, sum(arr, 80, 120)]));
const topPairs = [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => [...k.split('|'), v]);
writeFileSync(join(out, 'mentions.json'), JSON.stringify(mentions));
writeFileSync(join(out, 'stats.json'), JSON.stringify({ totals, sequel, firstSeen, companions, topPairs }));
writeFileSync(join(out, 'notes.json'), JSON.stringify(notesOf));
const rank = Object.entries(totals).sort((a, b) => b[1] - a[1]);
console.log('前八十回提到最多：', rank.slice(0, 20).map(([k, v]) => `${k}${v}`).join(' '));
console.log('前八十回没提到：', rank.filter(([, v]) => !v).map(([k]) => `${k}(续${sequel[k]})`).join(' '));
console.log('脂批点到的人：', Object.keys(notesOf).length, '位；最多的', Object.entries(notesOf).sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([k, v]) => `${k}${v.total}`).join(' '));
