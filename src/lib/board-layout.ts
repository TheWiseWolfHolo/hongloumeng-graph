/* 关系图的排版，构建时算好。人是一枚竖写名字的签，丝线是两签之间垂着的线。
   每层按 board.ts 的站位排：一簇一簇左右排开，簇内一行一行往下；二府各房同一辈对齐在同一行。
   丝线只从签的上端或下端接出，画在签的下面，所以不会压住名字。 */
import { PEOPLE } from '../data/people.ts';
import { EDGES } from '../data/relations.ts';
import { BANDS, SKY, type Band } from '../data/board.ts';

type P = [number, number];
export interface Slip { id: string; x: number; y: number; w: number; h: number; fs: number; tier: string; band: string }
export interface Thread { a: string; b: string; type: string; d: string; mid: P }
export interface Zone { id: string; name: string; y: number; h: number; clusters: { name: string; x: number; y: number; w: number }[] }

const tierOf = new Map(PEOPLE.map(p => [p.id, p.tier]));
/* 三档签：主要人物大签，次要的人小签 */
const SIZE = { c: { fs: 22, w: 36 }, m: { fs: 17, w: 29 }, s: { fs: 13.5, w: 23 }, o: { fs: 15, w: 26 } } as const;
const GAP_X = 12, GAP_ROW = 26, GAP_CLUSTER = 64, LABEL_H = 40, BAND_GAP = 90, BAND_LEFT = 110, SKY_H = 150;

function slipSize(id: string) {
  const t = (tierOf.get(id) ?? 's') as keyof typeof SIZE;
  const { fs, w } = SIZE[t];
  const n = [...id].length;
  return { fs, w, h: Math.round(n * fs * 1.12 + fs * 1.1), tier: t };
}

export function layBoard() {
  const slips = new Map<string, Slip>();
  const zones: Zone[] = [];
  let y = SKY_H + 40;
  let width = 0;

  /* 一簇里各签相对簇左上角的位置，和这一簇的宽高 */
  const shape = (c: Band['clusters'][number], rowH: number[] | null) => {
    const widths = c.rows.map(row => row.reduce((a, id) => a + slipSize(id).w, 0) + Math.max(0, row.length - 1) * GAP_X);
    const cw = Math.max(...widths, [...c.name].length * 16 + 8);
    const at: [string, number, number][] = [];
    let ry = LABEL_H;
    c.rows.forEach((row, r) => {
      const h = rowH ? rowH[r] : Math.max(0, ...row.map(id => slipSize(id).h));
      if (!row.length && !rowH) return;
      let rx = (cw - widths[r]) / 2;
      for (const id of row) { at.push([id, rx, ry]); rx += slipSize(id).w + GAP_X; }
      if (h) ry += h + GAP_ROW;
    });
    return { cw, ch: ry, at };
  };
  /* 和上面几层已经落位的亲人有多少根线，用来决定这一簇挂在哪里 */
  const kin = new Map<string, string[]>();
  for (const [a, b, t] of EDGES) {
    if (!['b', 'm', 'in', 'sv'].includes(t)) continue;
    if (!kin.has(a)) kin.set(a, []); if (!kin.has(b)) kin.set(b, []);
    kin.get(a)!.push(b); kin.get(b)!.push(a);
  }
  const placeBand = (band: Band, anchored: boolean) => {
    const top = y;
    const nRows = Math.max(...band.clusters.map(c => c.rows.length));
    /* 二府每行的高度取各房这一行最高的签，同一辈因此对齐 */
    const rowH = band.id === 'house' ? Array.from({ length: nRows }, (_, r) => Math.max(0, ...band.clusters.flatMap(c => (c.rows[r] ?? []).map(id => slipSize(id).h)))) : null;
    const shapes = band.clusters.map(c => shape(c, rowH));
    let seq = BAND_LEFT;
    const ideal = shapes.map((sh, i) => {
      const fallback = seq + sh.cw / 2; seq += sh.cw + GAP_CLUSTER;
      if (!anchored) return fallback;
      const xs = band.clusters[i].rows.flat().flatMap(id => (kin.get(id) ?? []).filter(o => slips.has(o)).map(o => slips.get(o)!.x + slips.get(o)!.w / 2));
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback;
    });
    /* 按理想位置排好，再用保序回归推开重叠的簇：总挪动最小，次序不乱 */
    const order = shapes.map((_, i) => i).sort((a, b) => ideal[a] - ideal[b]);
    let off = 0;
    const blocks: { sum: number; n: number; idx: number[] }[] = [];
    order.forEach(i => {
      const z = ideal[i] - shapes[i].cw / 2 - off;
      off += shapes[i].cw + GAP_CLUSTER;
      blocks.push({ sum: z, n: 1, idx: [i] });
      while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n > blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
        const last = blocks.pop()!; const prev = blocks[blocks.length - 1];
        prev.sum += last.sum; prev.n += last.n; prev.idx.push(...last.idx);
      }
    });
    const left = new Map<number, number>();
    off = 0;
    blocks.forEach(bk => bk.idx.forEach(i => { left.set(i, bk.sum / bk.n + off); off += shapes[i].cw + GAP_CLUSTER; }));
    const clusters: Zone['clusters'] = [];
    let bottom = top;
    band.clusters.forEach((c, i) => {
      const x = left.get(i)!;
      for (const [id, dx, dy] of shapes[i].at) {
        const s = slipSize(id);
        slips.set(id, { id, x: Math.round(x + dx), y: Math.round(top + dy), w: s.w, h: s.h, fs: s.fs, tier: s.tier, band: band.id });
      }
      clusters.push({ name: c.name, x: Math.round(x + shapes[i].cw / 2), y: top, w: Math.round(shapes[i].cw) });
      bottom = Math.max(bottom, top + shapes[i].ch);
    });
    zones.push({ id: band.id, name: band.name, y: top, h: bottom - top, clusters });
    y = bottom + BAND_GAP;
  };
  BANDS.forEach((band, i) => placeBand(band, i > 0));

  /* 整体挪回左边距，宽度取最右的签 */
  const minX = Math.min(...[...slips.values()].map(s => s.x));
  const shiftX = BAND_LEFT - minX;
  slips.forEach(s => { s.x += shiftX; });
  zones.forEach(z => z.clusters.forEach(c => { c.x += shiftX; }));
  width = Math.max(...[...slips.values()].map(s => s.x + s.w));

  /* 天上的人挂在凡间那个人的正上方；同挂一人的左右分开，两头的分站最左最右 */
  const skyY = 40;
  const over = new Map<string, string[]>();
  for (const [id, o] of SKY) { if (!over.has(o)) over.set(o, []); over.get(o)!.push(id); }
  for (const [o, ids] of over) {
    ids.forEach((id, i) => {
      const s = slipSize(id);
      let cx: number;
      if (o === 'left') cx = BAND_LEFT + 40;
      else if (o === 'right') cx = width - 40;
      else { const t = slips.get(o)!; cx = t.x + t.w / 2 + (i - (ids.length - 1) / 2) * 70; }
      slips.set(id, { id, x: Math.round(cx - s.w / 2), y: skyY + Math.round((SKY_H - s.h) / 2), w: s.w, h: s.h, fs: s.fs, tier: s.tier, band: 'sky' });
    });
  }
  zones.unshift({ id: 'sky', name: '太虛幻境', y: 0, h: SKY_H + 40, clusters: [] });

  const height = y - BAND_GAP + 40;
  return { width: width + 40, height, slips: [...slips.values()], zones, threads: threadsOf(slips) };
}

/* 丝线：上下相隔的从上面那枚签的下端垂到下面那枚签的上端；同一行的从两签上端牵出，中间往下垂 */
function threadsOf(slips: Map<string, Slip>): Thread[] {
  const f = (n: number) => n.toFixed(1);
  return EDGES.filter(([a, b]) => slips.has(a) && slips.has(b)).map(([a, b, type]) => {
    const A = slips.get(a)!, B = slips.get(b)!;
    const ac: P = [A.x + A.w / 2, A.y + A.h / 2], bc: P = [B.x + B.w / 2, B.y + B.h / 2];
    let d: string, mid: P;
    const sameRow = Math.abs(ac[1] - bc[1]) < Math.min(A.h, B.h) * .6;
    if (sameRow) {
      const p0: P = [ac[0], A.y + 3], p1: P = [bc[0], B.y + 3];
      const dx = Math.abs(p1[0] - p0[0]);
      /* 两头挂在签顶，越远垂得越深；隔得远的从上面绕过去，不穿过中间的签 */
      /* 天上那一行没有更高的地方可绕，一律往下垂 */
      const far = dx > 160 && A.band !== 'sky';
      const sag = far ? -Math.min(90, 20 + dx * .08) : Math.min(46, 10 + dx * .18);
      const c0: P = [p0[0] + (p1[0] - p0[0]) * .25, p0[1] + sag], c1: P = [p0[0] + (p1[0] - p0[0]) * .75, p1[1] + sag];
      d = `M${f(p0[0])} ${f(p0[1])}C${f(c0[0])} ${f(c0[1])} ${f(c1[0])} ${f(c1[1])} ${f(p1[0])} ${f(p1[1])}`;
      mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + sag * .75];
    } else {
      const [U, L] = ac[1] < bc[1] ? [A, B] : [B, A];
      const p0: P = [U.x + U.w / 2, U.y + U.h - 2], p1: P = [L.x + L.w / 2, L.y + 2];
      const k = Math.max(24, (p1[1] - p0[1]) * .45);
      d = `M${f(p0[0])} ${f(p0[1])}C${f(p0[0])} ${f(p0[1] + k)} ${f(p1[0])} ${f(p1[1] - k)} ${f(p1[0])} ${f(p1[1])}`;
      mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    }
    return { a, b, type, d, mid: [Math.round(mid[0]), Math.round(mid[1])] };
  });
}
