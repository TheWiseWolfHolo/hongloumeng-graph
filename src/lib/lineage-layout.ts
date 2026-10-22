/* 贾府世系的吊线图排版，照旧时族谱的画法：名字竖写，从上一代名下垂一根细线，横过一道，再分垂到每个孩子头上的小圆点。
   配偶竖写在本人右边，头上标“配”“妾”“缘”，女儿的丈夫标“适”；女儿本人头上标“女”。名字右边的小字是夹注。
   欧阳修定的谱例是五世一图，这里水、代、文、玉、草正好五辈。全部在构建时算好。 */
import { TREE_NING, TREE_RONG, GENERATIONS, type TreeNode } from '../data/lineage.ts';

const MW = 24, NW = 15, SG = 12, SW = 20, CG = 22, RH = 150, TOP = 74, LEFT = 30, GAP = 70;
const NF = 19, NS = 22.5, SF = 16, SS = 19.5, TS = 13, LS = 12;

interface Laid extends TreeNode { uw: number; kw: number; w: number; d: number; ux: number; y: number; mx: number; yEnd: number; ch?: Laid[] }
export interface Column { name: string; x: number; y: number; grp: string; spouse: boolean; ghost: boolean; link: boolean; lab: string[]; chars: { c: string; y: number }[]; notes: { c: string; x: number; y: number }[]; dotR: number; bg: { x: number; y: number; w: number; h: number; r: number }; size: number }

/* 夹注里“正室”“妾”和头上的标字重复，就不再写 */
const spNote = (s: TreeNode) => (s.s && s.s !== '正室' && s.s !== '妾' ? s.s : '');
const spLab = (t: TreeNode, s: TreeNode) => s.k || (s.t === 'c' ? '妾' : s.t === 'l' ? '缘' : t.g === 'f' ? '适' : '配');
const spW = (s: TreeNode) => SG + SW + (spNote(s) ? NW : 0);

function measure(t: Laid) {
  t.uw = MW + (t.s ? NW : 0) + (t.sp ?? []).reduce((a, s) => a + spW(s), 0);
  const ch = (t.ch ?? []) as Laid[];
  ch.forEach(measure);
  t.kw = ch.reduce((a, c) => a + c.w, 0) + CG * Math.max(0, ch.length - 1);
  t.w = Math.max(t.uw, t.kw);
}
function place(t: Laid, left: number, d: number) {
  t.d = d; t.ux = left + (t.w - t.uw) / 2; t.y = TOP + d * RH; t.mx = t.ux + MW / 2;
  let x = left + (t.w - t.kw) / 2;
  for (const c of (t.ch ?? []) as Laid[]) { place(c, x, d + 1); x += c.w + CG; }
}
function walk(t: Laid, fn: (t: Laid) => void) { fn(t); for (const c of (t.ch ?? []) as Laid[]) walk(c, fn); }

function column(x: number, y: number, name: string, o: { sp?: boolean; grp: string; note?: string; lab?: string; ghost?: boolean; xx?: boolean }): Column {
  const big = !o.sp, f = big ? NF : SF, step = big ? NS : SS;
  const lab = o.lab ? [...o.lab] : [], chars = [...name], notes = o.note ? [...o.note] : [];
  const y0 = y + 18 + (lab.length ? 6 + lab.length * LS : 0);
  const yEnd = y0 + (chars.length - 1) * step + f / 2;
  const nx = x + f / 2 + 7, bottom = Math.max(yEnd, y0 - f / 2 + notes.length * TS);
  return {
    name, x, y, grp: o.grp, spouse: !!o.sp, ghost: !!o.ghost, link: !o.xx, size: f,
    lab, dotR: big ? 4.4 : 3.8,
    chars: chars.map((c, i) => ({ c, y: y0 + i * step })),
    notes: notes.map((c, i) => ({ c, x: nx, y: y0 - f / 2 + TS / 2 + i * TS })),
    bg: { x: x - f / 2 - 5, y: y - 9, w: f + 10 + (notes.length ? NW - 2 : 0), h: bottom - y + 16, r: (f + 10) / 2 }
  };
}

export function layLineage() {
  const ning = structuredClone(TREE_NING) as Laid, rong = structuredClone(TREE_RONG) as Laid;
  measure(ning); measure(rong);
  place(ning, LEFT, 0);
  const rongLeft = LEFT + ning.w + GAP;
  place(rong, rongLeft, 0);
  const W = rongLeft + rong.w + LEFT;
  let maxD = 0;
  [ning, rong].forEach(r => walk(r, t => { maxD = Math.max(maxD, t.d); }));
  const H = TOP + maxD * RH + 128;

  const cols: Column[] = [];
  const ties: { cls: string; d: string }[] = [];
  const links: string[] = [];
  for (const r of [ning, rong]) walk(r, t => {
    const c = column(t.mx, t.y, t.n, { grp: t.grp, note: t.s, lab: t.g === 'f' && t.d ? '女' : '', xx: !!t.x });
    cols.push(c);
    t.yEnd = c.chars[c.chars.length - 1].y + c.size / 2;
    let cur = t.ux + MW + (t.s ? NW : 0), px = t.mx;
    for (const s of t.sp ?? []) {
      const sx = cur + SG + SW / 2;
      cols.push(column(sx, t.y, s.n, { sp: true, grp: s.grp, note: spNote(s), lab: spLab(t, s), ghost: s.t === 'l', xx: !!s.x }));
      const a = px + 7, b = sx - 6;
      if (s.t === 'w') ties.push({ cls: 'w', d: `M${a} ${t.y - 1.8}H${b}M${a} ${t.y + 1.8}H${b}` });
      else ties.push({ cls: s.t ?? '', d: `M${a} ${t.y}H${b}` });
      px = sx; cur += spW(s);
    }
  });
  for (const r of [ning, rong]) walk(r, t => {
    const ch = (t.ch ?? []) as Laid[];
    if (!ch.length) return;
    const ry = t.y + RH - 30, xs = ch.map(c => c.mx).concat(t.mx);
    let d = `M${t.mx} ${(t.yEnd + 9).toFixed(1)}V${ry}M${Math.min(...xs)} ${ry}H${Math.max(...xs)}`;
    for (const c of ch) d += `M${c.mx} ${ry}V${c.y - 6}`;
    links.push(d);
  });
  return {
    W, H, cols, ties, links, rongLeft,
    bands: GENERATIONS.map((g, i) => ({ ...g, y: TOP + i * RH - 26, h: RH - 24, mid: TOP + i * RH + 37 })),
    houses: [{ name: '宁国府', grp: 'ning', x: ning.mx + 6 }, { name: '荣国府', grp: 'rong', x: rong.mx + 6 }].map(h => ({ ...h, y: TOP - 44 })),
    bro: { d: `M${ning.mx + 8} ${TOP}H${rong.mx - 8}`, x: (ning.mx + rong.mx) / 2, y: TOP - 9 }
  };
}
