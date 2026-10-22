// 从维基文库取《红楼梦》一百二十回原文，转成简体，按段落与诗词拆好，写进 src/data/text/。
// 前八十回用《脂砚斋重评石头记》（庚辰、己卯、甲戌三本汇集），连同批语一起；回目也用脂本的。
// 后四十回是续书，用维基文库汇校本里的程甲本。各回的回目异文取自汇校本的校注。
// 用法 node scripts/build-text.mjs [--refresh]；原始 wikitext 缓存在 .text-cache/，--refresh 重新下载。
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';
import { zhiIndex, zhiRaw, cleanZhi, parseNote } from './zhi.mjs';

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

/* 脂本一回：正文分段，批语挂在所在段落的第几个字后面；单独成行的批语（多是回前回后的总批）自成一块 */
function parseZhi(wiki) {
  const { s, notes } = cleanZhi(wiki);
  const blocks = [];
  const NOTE = /\u0007(\d+)\u0008/g;
  const note = id => parseNote(toS(notes[id]));
  /* 把带占位符的一段转成 { s, n }，n 是挂在文字上的批语 */
  const withNotes = text => {
    const conv = toS(text).replace(/[ \t]+/g, '');
    let out = '', at = 0;
    const n = [];
    for (const m of conv.matchAll(NOTE)) {
      out += conv.slice(at, m.index);
      n.push({ at: out.length, ...note(+m[1]) });
      at = m.index + m[0].length;
    }
    out += conv.slice(at);
    return { s: out, n };
  };
  const pushLines = text => {
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (!t.replace(NOTE, '').trim()) {
        for (const m of t.matchAll(NOTE)) { const x = note(+m[1]); if (x.s) blocks.push({ t: 'pi', ...x }); }
        continue;
      }
      const { s: body, n } = withNotes(t);
      /* 段首的空格去掉后，批语位置跟着往前挪 */
      const lead = body.length - body.trimStart().length;
      const b = { t: 'p', s: body.trim() };
      if (n.length) b.n = n.map(x => ({ ...x, at: Math.min(b.s.length, Math.max(0, x.at - lead)) }));
      blocks.push(b);
    }
  };
  const re = /<poem[^>]*>([\s\S]*?)<\/poem>|\u0001CENTER([\s\S]*?)\u0002/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    pushLines(s.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] != null) {
      const lines = m[1].split('\n').map(l => l.replace(/^[:\s　]+/, '').trim()).filter(l => l.replace(NOTE, '').trim());
      if (!lines.length) continue;
      const { s: body, n } = withNotes(lines.join('\n'));
      const b = { t: 'poem', s: body };
      if (n.length) b.n = n;
      blocks.push(b);
    } else {
      const c = m[2].replace(NOTE, '').trim();
      /* 回目那一行不进正文，挂在回目上的批语照留 */
      for (const x of m[2].matchAll(NOTE)) { const y = note(+x[1]); if (y.s) blocks.push({ t: 'pi', ...y }); }
      if (c && !/^第.+回/.test(c)) blocks.push({ t: 'center', s: toS(c) });
    }
  }
  pushLines(s.slice(last));
  /* 抄本录入时常在批语处断行，段尾不是句末标点的，和下一段接起来 */
  const merged = [];
  for (const b of blocks) {
    const prev = merged[merged.length - 1];
    /* 没写出处的批语多是上一条的续行 */
    if (b.t === 'pi' && !b.src.length && prev?.t === 'pi') { prev.s += '\n' + b.s; continue; }
    if (b.t === 'p' && prev?.t === 'p' && !/[。！？”’…：」』）】]$/.test(prev.s)) {
      const off = prev.s.length;
      prev.s += b.s;
      if (b.n) prev.n = [...(prev.n ?? []), ...b.n.map(x => ({ ...x, at: x.at + off }))];
      continue;
    }
    merged.push(b);
  }
  /* 正文前后单独成行的批语，就是回前、回后的总批 */
  const first = merged.findIndex(b => b.t !== 'pi');
  const lastText = merged.length - 1 - [...merged].reverse().findIndex(b => b.t !== 'pi');
  merged.forEach((b, i) => {
    if (b.t !== 'pi' || b.kind === '回前' || b.kind === '回后') return;
    if (i < first) b.kind = '回前';
    else if (i > lastText) b.kind = '回后';
  });
  return merged;
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
  /* 底本把省亲一段分在第十八回，回目跟着底本走 */
  17: '会芳园试才题对额 贾宝玉机敏动诸宾',
  18: '林黛玉误剪香囊袋 贾元春归省庆元宵',
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
const zIndex = await zhiIndex(cache, refresh);
if (zIndex.length !== 80) throw new Error(`脂本目录只解析出 ${zIndex.length} 回`);
let total = 0, noteTotal = 0;
const countChars = blocks => blocks.filter(b => b.t !== 'pi').reduce((a, b) => a + b.s.replace(/[\s“”‘’，。：；！？、《》（）—…·]/g, '').length, 0);
for (let n = 1; n <= 120; n++) {
  const parsed = parse(n, await raw(n));
  const head = toS(parsed.title).replace(/^第[^回]+回\s*/, '').trim();
  const variants = parsed.variants.map(v => ({ text: toS(v.text), from: t2s(v.from) }));
  /* 人文社通行本的回目：有庚辰本异文时取庚辰本，个别回另行指定 */
  const gengchen = n <= 80 && variants.find(v => /庚辰本/.test(v.from) && !/庚辰本(作|无)/.test(v.from.split(/[，。]/)[0]));
  const common = (TITLE_FIX[n] ?? (gengchen ? gengchen.text : head)).split(/[\s　]+/).filter(Boolean);
  let couplet = common, blocks, source;
  if (n <= 80) {
    const z = zIndex[n - 1];
    couplet = toS(z.title).split(/[\s　]+/).filter(Boolean);
    blocks = parseZhi(await zhiRaw(cache, n, z.page, refresh));
    source = '脂本';
    if (couplet.join('') !== common.join('')) variants.unshift({ text: common.join(' '), from: '人民文学出版社通行本' });
  } else {
    blocks = parsed.blocks.map(b => ({ t: b.t, s: toS(b.s).replace(/[ 	]+/g, '') })).filter(b => b.s);
    source = '程甲本';
  }
  const chars = countChars(blocks);
  const notes = blocks.reduce((a, b) => a + (b.t === 'pi' ? 1 : b.n?.length ?? 0), 0);
  total += chars;
  noteTotal += notes;
  const data = { n, cn: `第${cn(n)}回`, title: couplet, wikiTitle: head.split(/[\s　]+/).filter(Boolean), source, variants, chars, notes, blocks };
  writeFileSync(join(out, `${pad(n)}.json`), JSON.stringify(data));
  index.push({ n, cn: data.cn, title: couplet, chars, notes });
}
writeFileSync(join(root, 'src', 'data', 'chapters.json'), JSON.stringify(index, null, 1));
console.log(`一百二十回写好，正文约 ${total} 字，脂批 ${noteTotal} 条`);
