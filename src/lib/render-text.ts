/* 把一回原文排成 HTML：段落、诗词、题注，正文里的人名换成链接，脂批按位置嵌进去 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findNames } from './names.ts';
import { byId, noteLabel } from './data.ts';

export interface Note { at: number; src: string[]; kind: string; s: string }
export interface Block { t: 'p' | 'poem' | 'center' | 'fig' | 'pi'; s: string; n?: Note[]; src?: string[]; kind?: string }
export interface ChapterText { n: number; cn: string; title: string[]; wikiTitle: string[]; source: string; variants: { text: string; from: string }[]; chars: number; notes: number; blocks: Block[] }

export function loadChapter(n: number): ChapterText {
  return JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'text', `${String(n).padStart(3, '0')}.json`), 'utf8'));
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const noteText = (s: string) => esc(s).replace(/\n/g, '<br>');

/* 甲戌、庚辰、己卯三本的批语是脂砚斋一系的原评，蒙府、戚序等本多是后人所加，颜色淡一些 */
const LATE = new Set(['蒙府', '戚序', '梦稿', '列藏', '甲辰', '舒序']);
const lateClass = (src: string[]) => (src.length && src.every(x => LATE.has(x)) ? ' late' : '');

let noteId = 0;
function noteHtml(x: Note) {
  const id = `z${++noteId}`;
  const kind = x.kind === '眉批' ? 'mei' : x.kind === '夹批' ? 'jia' : 'ce';
  return `<span class="zp zp-${kind}${lateClass(x.src)}"><button type="button" class="zp-dot" aria-expanded="false" aria-controls="${id}" aria-label="${esc(noteLabel(x))}"></button><span class="zp-text" id="${id}" role="note"><b>${esc(noteLabel(x))}</b>${noteText(x.s)}</span></span>`;
}

/* 人名换成链接，批语插在它挂着的字后面；批语落在人名中间的，挪到人名之后 */
function inline(s: string, n: number, notes: Note[] = []) {
  const hits = findNames(s, n);
  const queue = [...notes].sort((a, b) => a.at - b.at);
  let out = '', at = 0, qi = 0;
  const flush = (upto: number) => {
    while (qi < queue.length && queue[qi].at <= upto) {
      const x = queue[qi++];
      const pos = Math.max(at, x.at);
      out += esc(s.slice(at, pos)) + noteHtml(x);
      at = pos;
    }
  };
  for (const h of hits) {
    flush(h.start);
    out += esc(s.slice(at, h.start));
    const p = byId.get(h.id)!;
    const text = s.slice(h.start, h.end);
    out += `<a class="nm" href="/people/${h.id}/" data-peek data-id="${h.id}" style="--pc:var(--g-${p.group})"${text !== h.id ? ` title="${h.id}"` : ''}>${esc(text)}</a>`;
    at = h.end;
  }
  flush(Infinity);
  return out + esc(s.slice(at));
}

export function renderChapter(c: ChapterText) {
  let html = '';
  noteId = 0;
  c.blocks.forEach((b, i) => {
    const id = `p${i + 1}`;
    if (b.t === 'p') html += `<p id="${id}">${inline(b.s, c.n, b.n)}</p>`;
    else if (b.t === 'poem') {
      /* 诗按行拆开，批语的位置也按行换算 */
      let off = 0;
      const lines = b.s.split('\n').map(l => {
        const start = off;
        off += l.length + 1;
        const ns = (b.n ?? []).filter(x => x.at >= start && x.at <= start + l.length).map(x => ({ ...x, at: x.at - start }));
        return `<span>${inline(l, c.n, ns)}</span>`;
      });
      html += `<div class="poem" id="${id}">${lines.join('')}</div>`;
    }
    else if (b.t === 'center') html += `<p class="center" id="${id}">${inline(b.s, c.n)}</p>`;
    else if (b.t === 'pi') {
      const label = noteLabel({ src: b.src ?? [], kind: b.kind ?? '批' });
      const where = b.kind === '回前' ? ' zb-front' : b.kind === '回后' ? ' zb-back' : '';
      html += `<aside class="zb${where}${lateClass(b.src ?? [])}" id="${id}"><b class="zb-label">${esc(label)}</b><div class="zb-text">${noteText(b.s)}</div></aside>`;
    }
    else html += `<div class="fig" id="${id}">${b.s.split(/[\s　]+/).map(l => `<span>${esc(l)}</span>`).join('')}</div>`;
  });
  return html;
}
