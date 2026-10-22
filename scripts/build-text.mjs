// 从维基文库取《红楼梦》一百二十回原文，转成简体，按段落与诗词拆好，写进 src/data/text/。
// 底本是维基文库的汇校本：前八十回以庚辰本为底本，后四十回以程甲本为底本，不含批语。
// 用法 node scripts/build-text.mjs [--refresh]；原始 wikitext 缓存在 .text-cache/，--refresh 重新下载。
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.text-cache');
const out = join(root, 'src', 'data', 'text');
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });
const refresh = process.argv.includes('--refresh');
const UA = 'hongloumeng-graph/2.0 (https://github.com/TheWiseWolfHolo/hongloumeng-graph)';
const pad = n => String(n).padStart(3, '0');

async function raw(n) {
  const file = join(cache, `${pad(n)}.wiki`);
  if (!refresh && existsSync(file)) return readFileSync(file, 'utf8');
  const url = `https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(`紅樓夢/第${pad(n)}回`)}&action=raw`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`第${n}回下载失败 ${res.status}`);
  const text = await res.text();
  if (!text.includes('{{center')) throw new Error(`第${n}回内容不对`);
  writeFileSync(file, text);
  await new Promise(r => setTimeout(r, 400));
  return text;
}

const t2s = OpenCC.Converter({ from: 't', to: 'cn' });
/* 单个模板的参数拆分，忽略嵌套 */
function splitArgs(s) {
  const parts = []; let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], d = s.slice(i, i + 2);
    if (d === '{{' || d === '[[') { depth++; cur += d; i++; continue; }
    if (d === '}}' || d === ']]') { depth--; cur += d; i++; continue; }
    if (c === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

/* 找到最内层的 {{...}} 一层层展开 */
function expandTemplates(s, onFigure) {
  let guard = 0;
  while (/\{\{/.test(s) && guard++ < 5000) {
    const next = s.replace(/\{\{((?:(?!\{\{|\}\}).)*)\}\}/s, (_, body) => {
      const [name, ...args] = splitArgs(body);
      const key = name.trim();
      const pos = args.filter(a => !/^\s*[a-zA-Z-]+\s*=/.test(a));
      if (key === '僻字') return pos[0] ?? '';
      if (key === 'gap') return '';
      if (key === 'center') return `\u0001CENTER${pos.join('|')}\u0002`;
      if (key === 'ppoem') return `<poem>${pos.join('|')}</poem>`;
      if (key === '~~' || key === '!~' || key === 'larger' || key === 'smaller') return pos.join('|');
      if (/^(样式|樣式|清朝作品|未校訂|Textquality|header|檢索|Col)/i.test(key)) return '';
      return pos.join('|');
    });
    if (next === s) break;
    s = next;
  }
  return s;
}

function clean(wiki) {
  let s = wiki.replace(/\r/g, '').replace(/<center>([\s\S]*?)<\/center>/g, '{{center|$1}}');
  /* 回目异文写在注释里，先取出来再删注释 */
  const titleRef = /\{\{center\|'''([^']+)'''(?:<ref>([\s\S]*?)<\/ref>)?\}\}/.exec(s);
  const variants = [];
  if (titleRef?.[2]) {
    for (const m of titleRef[2].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const q = /[“"]([^”"]+)[”"]([^“"<]*)/.exec(m[1]);
      if (q) variants.push({ text: q[1].trim(), from: q[2].replace(/[。．]$/, '').trim() });
    }
  }
  s = s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
  s = s.replace(/<references\s*\/>/g, '').replace(/^==[^=\n]+==\s*$/gm, '');
  s = s.replace(/<section[^>]*\/>/g, '').replace(/<\/?span[^>]*>/g, '').replace(/<\/?(ul|li|div|br)[^>]*>/g, '');
  s = s.replace(/-\{([^}]*)\}-/g, '$1');
  s = s.replace(/\[\[File(?::|%3A)[^\]|]*\|[^\]]*?alt=([^\]|]+)[^\]]*\]\]/g, '\u0003$1\u0004');
  s = s.replace(/\[\[File(?::|%3A)[^\]]*\]\]/g, '');
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, (m, label) => /回目录|一回|下一回|上一回|高續/.test(label) ? '' : label);
  s = s.replace(/^-{4,}\s*$/gm, '');
  s = expandTemplates(s);
  s = s.replace(/'''?/g, '');
  return { s, variants };
}

/* 引号在原文里偶有开合写反的，按段落配对修正；「」『』统一成“”‘’ */
function fixQuotes(p) {
  p = p.replace(/「/g, '“').replace(/」/g, '”').replace(/『/g, '‘').replace(/』/g, '’');
  let open = false, out = '';
  for (const c of p) {
    if (c === '“') { out += open ? '”' : '“'; open = !open; continue; }
    if (c === '”') { out += open ? '”' : '“'; open = !open; continue; }
    out += c;
  }
  return out;
}

function parse(n, wiki) {
  const { s, variants } = clean(wiki);
  const blocks = [];
  let title = '';
  const pushPara = text => {
    for (const line of text.split(/\n{1,}/)) {
      const t = line.trim();
      if (!t) continue;
      const fig = /^\u0003(.+)\u0004$/.exec(t);
      if (fig) { blocks.push({ t: 'fig', s: fig[1] }); continue; }
      blocks.push({ t: 'p', s: t.replace(/[\u0003\u0004]/g, '') });
    }
  };
  /* 先切出诗与标题，其余按空行分段 */
  const re = /<poem[^>]*>([\s\S]*?)<\/poem>|\u0001CENTER([\s\S]*?)\u0002/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    pushPara(s.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] != null) {
      const lines = m[1].split('\n').map(l => l.replace(/^[:\s　]+/, '').trim()).filter(Boolean);
      if (lines.length) blocks.push({ t: 'poem', s: lines.join('\n') });
    } else {
      const c = m[2].trim();
      if (!title && /^第.+回/.test(c)) title = c;
      else if (c) blocks.push({ t: 'center', s: c });
    }
  }
  pushPara(s.slice(last));
  return { title, variants, blocks };
}

const NUM = '零一二三四五六七八九';
const cn = n => {
  if (n <= 10) return n === 10 ? '十' : NUM[n];
  if (n < 20) return '十' + (n % 10 ? NUM[n % 10] : '');
  if (n < 100) return NUM[Math.floor(n / 10)] + '十' + (n % 10 ? NUM[n % 10] : '');
  const r = n - 100;
  return '一百' + (r === 0 ? '' : r < 10 ? '零' + NUM[r] : r < 20 ? '一十' + (r % 10 ? NUM[r % 10] : '') : cn(r));
};

/* 原文里“著”几乎都是助词，简体通行本写“着”；只有下面几处是著作的著 */
const ZHU_KEEP = /是著书|编著|原著|论著|显著/g;
const zhu = s => {
  const kept = [];
  s = s.replace(ZHU_KEEP, m => { kept.push(m); return `\u0005${kept.length - 1}\u0006`; });
  return s.replace(/著/g, '着').replace(/\u0005(\d+)\u0006/g, (_, i) => kept[i]);
};
const toS = s => fixQuotes(zhu(t2s(s)).replace(/煕/g, '熙'));

/* 回目用人民文学出版社通行本的写法，下面几回和底本的回目不同 */
const TITLE_FIX = {
  7: '送宫花贾琏戏熙凤 宴宁府宝玉会秦钟',
  18: '皇恩重元妃省父母 天伦乐宝玉呈才藻',
  30: '宝钗借扇机带双敲 龄官划蔷痴及局外',
  39: '村姥姥是信口开合 情哥哥偏寻根究底',
  41: '栊翠庵茶品梅花雪 怡红院劫遇母蝗虫',
  50: '芦雪广争联即景诗 暖香坞雅制春灯谜',
  56: '敏探春兴利除宿弊 时宝钗小惠全大体',
  64: '幽淑女悲题五美吟 浪荡子情遗九龙佩',
  74: '惑奸谗抄检大观园 矢孤介杜绝宁国府',
  80: '美香菱屈受贪夫棒 王道士胡诌妒妇方',
  102: '宁国府骨肉病灾祲 大观园符水驱妖孽'
};
const index = [];
let total = 0;
for (let n = 1; n <= 120; n++) {
  const parsed = parse(n, await raw(n));
  const head = toS(parsed.title).replace(/^第[^回]+回\s*/, '').trim();
  const variants = parsed.variants.map(v => ({ text: toS(v.text), from: t2s(v.from) }));
  /* 通行的人文社本前八十回回目多从庚辰本，这里有庚辰本异文时取庚辰本 */
  const gengchen = n <= 80 && variants.find(v => /庚辰本/.test(v.from) && !/庚辰本(作|无)/.test(v.from.split(/[，。]/)[0]));
  const couplet = (TITLE_FIX[n] ?? (gengchen ? gengchen.text : head)).split(/[\s　]+/).filter(Boolean);
  const blocks = parsed.blocks.map(b => ({ t: b.t, s: toS(b.s).replace(/[ \t]+/g, '') })).filter(b => b.s);
  const chars = blocks.reduce((a, b) => a + b.s.replace(/[\s“”‘’，。：；！？、《》（）—…·]/g, '').length, 0);
  total += chars;
  const data = { n, cn: `第${cn(n)}回`, title: couplet, wikiTitle: head.split(/[\s　]+/).filter(Boolean), variants, chars, blocks };
  writeFileSync(join(out, `${pad(n)}.json`), JSON.stringify(data));
  index.push({ n, cn: data.cn, title: couplet, chars });
}
writeFileSync(join(root, 'src', 'data', 'chapters.json'), JSON.stringify(index, null, 1));
console.log(`一百二十回写好，正文约 ${total} 字`);
