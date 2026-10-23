/* 关系总图的布局，构建时算好。全景画成一面铜镜的镜背：九个家族各占一段扇区，人物沿内圈排开；
   主要人物占的角度大，名字写得下大字，次要的人挤一些。扇区内部按“亲友的平均位置”重排几轮，让一房的人挨在一起。
   关系线从镜心穿过，跨家族的线先收向本族的枢点再分出去；每条线算成两头尖、中间粗的笔触轮廓，像毛笔勾出来的。 */
import { PEOPLE, EDGES, STATS, type GroupId } from './data.ts';

export const R = 360;
/* 荣府居顶，宁府、薛家分在两侧；官场僧道紧挨荣府，因为两边往来最多 */
const ORDER: GroupId[] = ['rong', 'xue', 'lin', 'shi', 'wang', 'myth', 'ning', 'oth', 'out'];
const WEIGHT = { c: 2.4, m: 1.3, s: .75, o: .75 } as const;
const GAP = 2.6;
const TIER_RANK = { c: 0, m: 1, s: 2, o: 3 } as const;

type P = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (deg: number, r: number): P => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r];
const f1 = (n: number) => n.toFixed(1);

/* 一串三次贝塞尔段，按笔触的粗细变化描出闭合轮廓：起笔、收笔细，中段最粗 */
export function taper(segs: [P, P, P, P][], wMax: number, wMin = .35, n = 10) {
  const pts: P[] = [];
  segs.forEach(([a, b, c, d], si) => {
    for (let i = si ? 1 : 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
    }
  });
  const L: P[] = [], Rt: P[] = [];
  pts.forEach((p, i) => {
    const q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(pts.length - 1, i + 1)];
    let dx = q1[0] - q0[0], dy = q1[1] - q0[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const t = i / (pts.length - 1);
    const w = wMin + (wMax - wMin) * Math.pow(Math.sin(Math.PI * t), .7);
    L.push([p[0] - dy * w, p[1] + dx * w]);
    Rt.push([p[0] + dy * w, p[1] - dx * w]);
  });
  const all = [...L, ...Rt.reverse()];
  return 'M' + all.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L') + 'Z';
}

export function layWheel() {
  const mentions = (id: string) => (STATS.totals[id] ?? 0) + (STATS.sequel?.[id] ?? 0) * .5;
  const neigh = new Map<string, string[]>();
  for (const [a, b] of EDGES) {
    if (!neigh.has(a)) neigh.set(a, []);
    if (!neigh.has(b)) neigh.set(b, []);
    neigh.get(a)!.push(b); neigh.get(b)!.push(a);
  }
  const tierOf = new Map(PEOPLE.map(p => [p.id, p.tier]));
  const groups = ORDER.map(g => ({ g, ids: PEOPLE.filter(p => p.group === g).sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || mentions(b.id) - mentions(a.id)).map(p => p.id) }));

  /* 扇区内重排：每人挪向同族亲友的平均位置，十几轮后同一房的人就聚到一处 */
  for (const grp of groups) {
    let order = grp.ids;
    for (let it = 0; it < 24; it++) {
      const pos = new Map(order.map((id, i) => [id, i]));
      const want = order.map((id, i) => {
        const ns = (neigh.get(id) ?? []).filter(n => pos.has(n));
        return ns.length ? (i + ns.reduce((a, n) => a + pos.get(n)!, 0) * 2 / ns.length) / 3 : i;
      });
      order = order.map((id, i) => [id, want[i]] as const).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    }
    /* 让最重要的人落在扇区中段 */
    const top = order.indexOf(grp.ids[0]);
    const shift = Math.round(order.length / 2) - top;
    if (order.length > 4) order = order.map((_, i) => order[(i - shift + order.length * 4) % order.length]);
    grp.ids = order;
  }

  const total = PEOPLE.reduce((a, p) => a + WEIGHT[p.tier], 0) + GAP * ORDER.length;
  const unit = 360 / total;
  const w = (id: string) => WEIGHT[tierOf.get(id)!] * unit;
  /* 让荣府扇区的中点正对上方 */
  const rongSpan = groups[0].ids.reduce((a, id) => a + w(id), 0);
  let ang = -90 - rongSpan / 2;
  const nodes: { id: string; group: GroupId; tier: string; a: number; r: number; x: number; y: number }[] = [];
  const sectors: { g: GroupId; a0: number; a1: number; mid: number; n: number }[] = [];
  for (const grp of groups) {
    const a0 = ang;
    for (const id of grp.ids) {
      const p = PEOPLE.find(q => q.id === id)!;
      const c = ang + w(id) / 2;
      const r = p.tier === 'c' ? 5.5 : p.tier === 'm' ? 3.6 : 2.4;
      const [x, y] = pt(c, R);
      nodes.push({ id, group: p.group, tier: p.tier, a: +(((c % 360) + 360) % 360).toFixed(2), r, x: +f1(x), y: +f1(y) });
      ang += w(id);
    }
    sectors.push({ g: grp.g, a0: +a0.toFixed(2), a1: +ang.toFixed(2), mid: +((a0 + ang) / 2).toFixed(2), n: grp.ids.length });
    ang += GAP * unit;
  }

  const at = new Map(nodes.map(n => [n.id, n]));
  const hubOf = new Map(sectors.map(s => [s.g, s.mid]));
  const WMAX: Record<string, number> = { b: 2.6, m: 3, in: 2, sv: 1.5, lv: 2.6, fr: 1.8, ri: 2, my: 1.8 };
  const links = EDGES.filter(([a, b]) => at.has(a) && at.has(b)).map(([a, b, type]) => {
    const A = at.get(a)!, B = at.get(b)!;
    const pa: P = [A.x, A.y], pb: P = [B.x, B.y];
    let segs: [P, P, P, P][];
    if (A.group === B.group) {
      let delta = Math.abs(A.a - B.a); if (delta > 180) delta = 360 - delta;
      const depth = R * (0.9 - Math.min(0.6, delta / 80));
      segs = [[pa, pt(A.a, depth), pt(B.a, depth), pb]];
    } else {
      const ha = hubOf.get(A.group)!, hb = hubOf.get(B.group)!;
      const p1 = pt(A.a, R * .66), h1 = pt(ha, R * .4), h2 = pt(hb, R * .4), p2 = pt(B.a, R * .66);
      const mid: P = [(h1[0] + h2[0]) / 2, (h1[1] + h2[1]) / 2];
      const h2r: P = [2 * mid[0] - h1[0], 2 * mid[1] - h1[1]];
      segs = [[pa, p1, h1, mid], [mid, h2r, p2, pb]];
    }
    /* 两头都是主要人物的线画粗一点 */
    const big = A.tier === 'c' && B.tier === 'c' ? 1.35 : A.tier === 'c' || B.tier === 'c' ? 1.1 : .85;
    return { a, b, type, d: taper(segs, WMAX[type] * big), cross: A.group !== B.group };
  });
  return { R, nodes, links, sectors };
}
