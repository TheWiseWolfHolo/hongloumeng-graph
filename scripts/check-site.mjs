// 构建后自检：主要页面都在，站内链接都指向存在的页面，字体和图片取得到。
// 用法 node scripts/check-site.mjs（先跑 astro build）
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!existsSync(dist)) { console.error('没有 dist，先跑 astro build'); process.exit(1); }

const MUST = {
  'index.html': ['红楼梦', '/fonts/fonts.css'],
  'graph/index.html': ['关系总图', '按回次演进关系网'],
  'garden/index.html': ['大观园', '题对额'],
  'timeline/index.html': ['大事眉批'],
  'twelve/index.html': ['金陵十二钗', '八支花籤', '大觀園詩社七集'],
  'lineage/index.html': ['贾府世系'],
  'families/index.html': ['四大家族'],
  'love/index.html': ['木石前盟'],
  'about/index.html': ['凡例', '有正'],
  'chapters/index.html': ['一百二十回'],
  'chapters/1/index.html': ['甄士隐', '夹签', '摘句', '刻本摘句笺'],
  'chapters/120/index.html': ['续书'],
  'people/index.html': ['人物谱'],
  'people/林黛玉/index.html': ['林黛玉', '同段提及'],
  '404.html': ['四〇四'],
  'fonts/fonts.css': ['HLM Serif', 'HLM Qiji'],
  'manifest.webmanifest': ['红楼梦']
};

const errors = [];
for (const [f, needles] of Object.entries(MUST)) {
  const p = join(dist, f);
  if (!existsSync(p)) { errors.push(`缺少 ${f}`); continue; }
  const s = readFileSync(p, 'utf8');
  for (const n of needles) if (!s.includes(n)) errors.push(`${f} 里没有「${n}」`);
}

/* 扫所有 HTML 里的站内链接 */
const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.html')) pages.push(p);
  }
})(dist);

const exists = new Map();
function resolve(url) {
  if (exists.has(url)) return exists.get(url);
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  const p = join(dist, path);
  const ok = path === '/' || existsSync(p) && (statSync(p).isFile() || existsSync(join(p, 'index.html')));
  exists.set(url, ok);
  return ok;
}
let links = 0;
const broken = new Map();
for (const p of pages) {
  const s = readFileSync(p, 'utf8');
  for (const m of s.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const url = m[1].replace(/&amp;/g, '&');
    if (url.startsWith('//')) continue;
    links++;
    if (!resolve(url)) broken.set(url, (broken.get(url) ?? 0) + 1);
  }
}
for (const [u, n] of broken) errors.push(`死链 ${u}（${n} 处）`);

/* 校验 120 回原文与脂批 JSON 不含残留维基标记或校记符号 */
const textDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'text');
for (const f of readdirSync(textDir).filter(x => x.endsWith('.json'))) {
  const ch = JSON.parse(readFileSync(join(textDir, f), 'utf8'));
  for (let i = 0; i < ch.blocks.length; i++) {
    const b = ch.blocks[i];
    if (/[【】{}[\]<>]|::|[a-zA-Z]/.test(b.s)) errors.push(`${f}#p${i + 1} 正文含残留标记: ${b.s.slice(0, 40)}`);
    for (const n of b.n || []) {
      if (/[【】{}[\]<>]|::|[a-zA-Z]/.test(n.s)) errors.push(`${f}#p${i + 1} 批语含残留标记: ${n.s.slice(0, 40)}`);
    }
  }
}

console.log(`${pages.length} 个页面，${links} 个站内链接`);
if (errors.length) {
  console.error(errors.slice(0, 40).join('\n'));
  if (errors.length > 40) console.error(`……另有 ${errors.length - 40} 条`);
  process.exit(1);
}
console.log('自检通过');
