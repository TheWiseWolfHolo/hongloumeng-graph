// 维基文库《脂砚斋重评石头记》八十回：正文汇集庚辰、己卯、甲戌三本，批语逐条嵌在正文里，
// 写法是 {{~|【甲戌侧批：……】}}。这里把批语拆出来，记下它挂在哪一段、第几个字后面。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'hongloumeng-graph/2.0 (https://github.com/TheWiseWolfHolo/hongloumeng-graph)';
const BOOK = '脂硯齋重評石頭記';

export async function zhiIndex(cache, refresh) {
  const dir = join(cache, 'zhi');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'index.wiki');
  let text;
  if (!refresh && existsSync(file)) text = readFileSync(file, 'utf8');
  else {
    const res = await fetch(`https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(BOOK)}&action=raw`, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`脂本目录下载失败 ${res.status}`);
    text = await res.text();
    writeFileSync(file, text);
  }
  /* *[[/第一回|第　一　回]]　甄士隱夢幻識通靈　賈雨村風塵懷閨秀 */
  return [...text.matchAll(/^\*\[\[\/(第[^|\]]+回)\|[^\]]*\]\][\s　]*(.*)$/gm)].map(m => ({ page: m[1], title: m[2].replace(/-{([^}]*)}-/g, '$1').trim() }));
}

export async function zhiRaw(cache, n, page, refresh) {
  const file = join(cache, 'zhi', `${String(n).padStart(3, '0')}.wiki`);
  if (!refresh && existsSync(file)) return readFileSync(file, 'utf8');
  const res = await fetch(`https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(`${BOOK}/${page}`)}&action=raw`, { headers: { 'user-agent': UA } });
  const text = await res.text();
  if (!res.ok || !text.includes('{{header')) throw new Error(`脂本${page}下载失败 ${res.status}`);
  writeFileSync(file, text);
  await new Promise(r => setTimeout(r, 300));
  return text;
}

function splitArgs(s) {
  const parts = []; let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const d = s.slice(i, i + 2);
    if (d === '{{' || d === '[[') { depth++; cur += d; i++; continue; }
    if (d === '}}' || d === ']]') { depth--; cur += d; i++; continue; }
    if (s[i] === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += s[i];
  }
  parts.push(cur);
  return parts;
}

/* 版本简称对照。蒙府、戚序两本的批语多是后人所加，页面上照样注明出处 */
const SOURCES = [
  [/^(甲戌|甲)/, '甲戌'], [/^(庚辰|庚|辰)/, '庚辰'], [/^(己卯|已卯|己)/, '己卯'],
  [/^蒙/, '蒙府'], [/^戚/, '戚序'], [/^靖(藏|本)?/, '靖藏'], [/^(梦|夢|杨|楊)/, '梦稿'], [/^列/, '列藏'], [/^(觉|覺)/, '甲辰'], [/^舒/, '舒序']
];
function label(raw) {
  let rest = raw.replace(/\s/g, '');
  const src = [];
  for (let guard = 0; guard < 6 && rest; guard++) {
    const hit = SOURCES.find(([re]) => re.test(rest));
    if (!hit) break;
    rest = rest.replace(hit[0], '');
    if (!src.includes(hit[1])) src.push(hit[1]);
    rest = rest.replace(/^[、，,]/, '');
  }
  let kind = '批';
  if (/回前/.test(rest)) kind = '回前';
  else if (/回(末|后|後|尾)/.test(rest)) kind = '回后';
  else if (/眉/.test(rest)) kind = '眉批';
  else if (/[夹夾双雙]/.test(rest)) kind = '夹批';
  else if (/[侧側旁]/.test(rest)) kind = '侧批';
  return { src, kind };
}

/* 把一条批语的原文拆成出处、类别和内容 */
export function parseNote(text) {
  /* 抄录时的折行去掉，只留句末之后的分段 */
  const t = text.trim().replace(/^【/, '').replace(/】$/, '')
    .replace(/\n+(?=[，。、；：！？”’）])/g, '')
    .replace(/([^。！？”’）】\n])\n+/g, '$1');
  const m = /^([^：:】]{1,14})[：:]([\s\S]*)$/.exec(t);
  if (!m) return { src: [], kind: '批', s: t };
  const l = label(m[1]);
  /* “题曰”一类不是版本名，整句留着 */
  if (!l.src.length && !/批|评|評/.test(m[1])) return { src: [], kind: '批', s: t };
  return { ...l, s: m[2].trim() };
}

/* 展开模板：批语换成占位符 \u0007序号\u0008，正文模板照常展开 */
export function cleanZhi(wiki) {
  let s = wiki.replace(/\r/g, '').replace(/﻿/g, '');
  /* 第六十七回庚辰本缺，页面并列了列藏本和程高本两种文字，取列藏本 */
  s = s.replace(/^==程高本==[\s\S]*$/m, '');
  s = s.replace(/-\{([^}]*)\}-/g, '$1');
  s = s.replace(/<font style="display:none">[\s\S]*?<\/font>/g, '');
  s = s.replace(/<center>([\s\S]*?)<\/center>/g, '{{center|$1}}');
  s = s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '').replace(/<references\s*\/>/g, '');
  s = s.replace(/^==[^=\n]+==\s*$/gm, '');
  const notes = [];
  let guard = 0;
  while (/\{\{/.test(s) && guard++ < 20000) {
    const next = s.replace(/\{\{((?:(?!\{\{|\}\}).)*)\}\}/s, (_, body) => {
      const [name, ...args] = splitArgs(body);
      const key = name.trim();
      if (key === '~' || key === '~~') { notes.push(args.join('|')); return `\u0007${notes.length - 1}\u0008`; }
      if (key === '*' || key === 'gap' || /^(header|Footer|未校訂|Textquality)/i.test(key)) return '\n';
      if (key === '另' || key === '僻字') return args[0] ?? '';
      if (key === 'center') return `\u0001CENTER${args.join('|')}\u0002`;
      return args.join('|');
    });
    if (next === s) break;
    s = next;
  }
  /* 一条长批语有时拆成好几个模板连着写，按【】配对合回一条 */
  s = s.replace(/\u0007(\d+)\u0008((?:[\s　]|<br\s*\/?>)*\u0007\d+\u0008)+/g, run => {
    const ids = [...run.matchAll(/\u0007(\d+)\u0008/g)].map(m => +m[1]);
    const out = [];
    let open = -1;
    for (const id of ids) {
      const t = notes[id].trim();
      if (open >= 0) {
        notes[open] += '\n' + t;
        if (t.endsWith('】')) open = -1;
        continue;
      }
      out.push(id);
      if (t.startsWith('【') && !t.endsWith('】')) open = id;
    }
    return out.map(id => `\u0007${id}\u0008`).join('\n');
  });
  s = s.replace(/<br\s*\/?>/g, '\n').replace(/<\/?(span|div|ul|li|sub|font)[^>]*>/g, '');
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '');
  return { s, notes };
}
