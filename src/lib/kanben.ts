/* 把一回开头的原文排成刻本的版面：一个半叶 COLS 行，每行 ROWS 字，从右往左、从上往下。
   右半叶先排书名、回次、回目，再接正文；左半叶接着排。
   夹批排成双行小字，侧批、眉批写进天头；标点去掉，句末打圈、句中打点，照旧时圈点的样子。
   排版在构建时算好，每个字落在哪一格都是整数坐标，界行和字不会错位。 */
import { Converter } from 'opencc-js';
import { loadChapter, type Note } from './render-text.ts';

/* 原文库是简体，刻本页面转成繁体；转换逐字对应，长度不变，脂批挂的位置不受影响 */
const s2t = Converter({ from: 'cn', to: 't' });
export const toTrad = (s: string) => { const t = s2t(s); return t.length === s.length ? t : s; };

export const COLS = 8;
export const ROWS = 18;
/* 天头每行能写几个小字 */
const MEI_ROWS = 6;

/* 一格里的字：c 是第几行（两个半叶连着数，0 到 2*COLS-1），r 是第几字；
   k：0 正文，1 书名回目，2 夹批右行，3 夹批左行（夹批的 r 按半格计） */
export type Cell = [c: number, r: number, ch: string, k: number];
/* 圈点：0 句圈，1 读点；朱笔加在那个字右下角 */
export type Mark = [c: number, r: number, k: number];
/* 天头批语：挂在第几行上方，字是哪些 */
export type Mei = [c: number, s: string, src: string];
export interface Spread { n: number; cells: Cell[]; marks: Mark[]; mei: Mei[]; back?: Cell[] }

const JU = new Set('。！？');
const DOU = new Set('，、；：');
const SKIP = /[“”‘’「」『』《》〈〉（）()…—\-·\s　]/;
const isHan = (ch: string) => /\p{Script=Han}/u.test(ch);
const plain = (s: string) => [...toTrad(s)].filter(isHan).join('');

export function layout(n: number, pages = 3): Spread & { cols: number } {
  const ch = loadChapter(n);
  const cells: Cell[] = [];
  const marks: Mark[] = [];
  const mei: Mei[] = [];
  const meiCols = new Set<number>();
  const END = pages === Infinity ? Infinity : COLS * pages;
  let c = 0, r = 0;
  const full = () => c >= END;
  const newline = () => { if (r > 0) { c++; r = 0; } };
  const put = (s: string, k: number, indent = 0) => {
    r = indent;
    for (const x of s) { if (isHan(x)) cells.push([c, r++, x, k]); }
    c++; r = 0;
  };

  /* 卷端：书名顶格，回次低两格，回目两句低四格。前八十回是庚辰本，后四十回是程甲本，卷端题名不同 */
  put(n <= 80 ? '脂硯齋重評石頭記' : '紅樓夢', 1);
  put(ch.cn, 1, 2);
  put(toTrad(ch.title[0]), 1, 4);
  put(toTrad(ch.title[1]), 1, 4);

  const main = (x: string) => {
    if (full()) return;
    if (r >= ROWS) { c++; r = 0; if (full()) return; }
    cells.push([c, r, x, 0]);
    r++;
  };
  const lastCell = () => { for (let i = cells.length - 1; i >= 0; i--) if (cells[i][3] === 0) return cells[i]; };
  const punct = (x: string) => {
    const last = lastCell();
    if (!last) return;
    if (JU.has(x)) marks.push([last[0], last[1], 0]);
    else if (DOU.has(x)) marks.push([last[0], last[1], 1]);
  };
  /* 双行夹注：小字半格高，一格里左右两行各写两字；本行写不完换行接着写。夹注字的 r 按半格计 */
  const jia = (s: string) => {
    let t = [...plain(s)];
    while (t.length && !full()) {
      if (r >= ROWS) { c++; r = 0; if (full()) return; }
      const room = (ROWS - r) * 2;
      const k = Math.min(room, Math.ceil(t.length / 2));
      t.slice(0, k).forEach((x, i) => cells.push([c, r * 2 + i, x, 2]));
      t.slice(k, 2 * k).forEach((x, i) => cells.push([c, r * 2 + i, x, 3]));
      t = t.slice(2 * k);
      r += Math.ceil(k / 2);
    }
  };
  /* 侧批、眉批放进天头，写得下才放，写不下的不截断 */
  const side = (x: Note) => {
    const s = plain(x.s);
    if (!s || s.length > MEI_ROWS * 2 || meiCols.has(c) || meiCols.has(c - 1) || full()) return;
    meiCols.add(c);
    mei.push([c, s, x.src[0] ?? '']);
  };

  for (const b of ch.blocks) {
    if (full()) break;
    if (b.t !== 'p' && b.t !== 'poem') continue;
    newline();
    const notes = [...(b.n ?? [])].sort((a, z) => a.at - z.at);
    let qi = 0;
    const flush = (at: number) => {
      while (qi < notes.length && notes[qi].at <= at) {
        const x = notes[qi++];
        if (x.kind === '夹批') jia(x.s);
        else side(x);
      }
    };
    const s = [...toTrad(b.s)];
    /* 诗句每句另起一行，低两格 */
    if (b.t === 'poem') r = 2;
    for (let i = 0; i < s.length && !full(); i++) {
      flush(i);
      const x = s[i];
      if (x === '\n') { newline(); if (b.t === 'poem') r = 2; continue; }
      if (isHan(x)) main(x);
      else if (JU.has(x) || DOU.has(x)) punct(x);
      else if (SKIP.test(x)) continue;
    }
    flush(Infinity);
  }
  return { n, cols: r > 0 ? c + 1 : c, cells: cells.filter(x => x[0] < END), marks: marks.filter(x => x[0] < END), mei };
}

/* 首页用的一份：本回开头三个半叶（右页、左页、左页那张纸的另一半），
   再加上一回最后一个半叶，那是右页那张纸的另一半。薄纸透光，两页背后隐约透出的反字就是它们 */
export function spread(n: number): Spread {
  const sp = layout(n, 3);
  let back: Cell[] = [];
  if (n > 1) {
    const prev = layout(n - 1, Infinity);
    const from = Math.max(0, Math.ceil(prev.cols / COLS) * COLS - COLS);
    back = prev.cells.filter(x => x[0] >= from && x[3] < 2).map(([c, r, ch, k]) => [c - from, r, ch, k] as Cell);
  }
  return { n, cells: sp.cells, marks: sp.marks, mei: sp.mei, back };
}
