/* 关系星图的布局，构建时算好。画成一张圆形星图：九个家族各占一段扇区，人物沿圆周排开；
   扇区内部反复按“亲友的平均位置”重排几轮，让有关系的人挨在一起。
   关系线从圆里穿过，跨家族的线先收向本族的“枢点”再分出去，同族的线成束，不会缠成一团。 */
import { PEOPLE, EDGES, STATS, type GroupId } from './data.ts';

export const R = 440;
/* 荣府居顶，宁府、薛家分在两侧；官场僧道紧挨荣府，因为两边往来最多 */
const ORDER: GroupId[] = ['rong', 'xue', 'lin', 'shi', 'wang', 'myth', 'ning', 'oth', 'out'];
const GAP = 2.4;
const TIER_RANK = { c: 0, m: 1, s: 2, o: 3 } as const;

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (deg: number, r: number) => [+(Math.cos(rad(deg)) * r).toFixed(1), +(Math.sin(rad(deg)) * r).toFixed(1)] as const;

export function layWheel() {
  const mentions = (id: string) => (STATS.totals[id] ?? 0) + (STATS.sequel?.[id] ?? 0) * .5;
  const neigh = new Map<string, string[]>();
  for (const [a, b] of EDGES) {
    if (!neigh.has(a)) neigh.set(a, []);
    if (!neigh.has(b)) neigh.set(b, []);
    neigh.get(a)!.push(b); neigh.get(b)!.push(a);
  }
  const groupOf = new Map(PEOPLE.map(p => [p.id, p.group]));
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
    /* 让最重要的人落在扇区中段，而不是挤在边上 */
    const top = order.indexOf(grp.ids[0]);
    const shift = Math.round(order.length / 2) - top;
    if (order.length > 4) order = order.map((_, i) => order[(i - shift + order.length * 4) % order.length]);
    grp.ids = order;
  }

  const total = PEOPLE.length + GAP * ORDER.length;
  const step = 360 / total;
  /* 让荣府扇区的中点正对上方 */
  const rongSpan = groups[0].ids.length * step;
  let ang = -90 - rongSpan / 2 + step / 2;
  const nodes: { id: string; group: GroupId; tier: string; a: number; r: number; x: number; y: number; m: number }[] = [];
  const sectors: { g: GroupId; a0: number; a1: number; mid: number; n: number }[] = [];
  for (const grp of groups) {
    const a0 = ang - step / 2;
    for (const id of grp.ids) {
      const p = PEOPLE.find(q => q.id === id)!;
      const m = mentions(id);
      const r = p.tier === 'c' ? 4.6 + Math.min(4, Math.sqrt(m) / 9) : p.tier === 'm' ? 3.4 : 2.6;
      const [x, y] = pt(ang, R);
      nodes.push({ id, group: p.group, tier: p.tier, a: +(((ang % 360) + 360) % 360).toFixed(2), r: +r.toFixed(1), x, y, m });
      ang += step;
    }
    const a1 = ang - step / 2;
    sectors.push({ g: grp.g, a0: +a0.toFixed(2), a1: +a1.toFixed(2), mid: +((a0 + a1) / 2).toFixed(2), n: grp.ids.length });
    ang += GAP * step;
  }

  const at = new Map(nodes.map(n => [n.id, n]));
  const hubOf = new Map(sectors.map(s => [s.g, s.mid]));
  /* 跨族的线：a → 本族枢点 → 对方枢点 → b；同族的线按两人相隔多远决定往里弯多深 */
  const links = EDGES.filter(([a, b]) => at.has(a) && at.has(b)).map(([a, b, type]) => {
    const A = at.get(a)!, B = at.get(b)!;
    let d: string;
    if (A.group === B.group) {
      let delta = Math.abs(A.a - B.a); if (delta > 180) delta = 360 - delta;
      const depth = R * (0.9 - Math.min(0.62, delta / 90));
      const [c1x, c1y] = pt(A.a, depth), [c2x, c2y] = pt(B.a, depth);
      d = `M${A.x} ${A.y}C${c1x} ${c1y} ${c2x} ${c2y} ${B.x} ${B.y}`;
    } else {
      const ha = hubOf.get(A.group)!, hb = hubOf.get(B.group)!;
      const [p1x, p1y] = pt(A.a, R * .62), [h1x, h1y] = pt(ha, R * .3);
      const [h2x, h2y] = pt(hb, R * .3), [p2x, p2y] = pt(B.a, R * .62);
      const mx = +((h1x + h2x) / 2).toFixed(1), my = +((h1y + h2y) / 2).toFixed(1);
      d = `M${A.x} ${A.y}C${p1x} ${p1y} ${h1x} ${h1y} ${mx} ${my}S${p2x} ${p2y} ${B.x} ${B.y}`;
    }
    return { a, b, type, d, cross: A.group !== B.group };
  });
  void groupOf;
  return { R, nodes, links, sectors, step };
}
