/* 关系星图的布局，构建时算好。每个家族围着自己的岛心聚成一团，荣国府居中；
   人与人之间互相排斥，有关系的拉近，再各自被岛心轻轻拉回。随机数用固定种子，每次构建结果一样。 */
import { PEOPLE, EDGES, STATS, type GroupId } from './data.ts';

const CENTER: Record<GroupId, [number, number]> = {
  rong: [0, 0], ning: [-720, -60], shi: [-380, -600], wang: [380, -600], xue: [720, -80],
  lin: [-420, 560], oth: [-960, 420], out: [900, 480], myth: [0, -940]
};
const R = { c: 11, m: 7.5, s: 5, o: 5.5 } as const;

function rng(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GNode { id: string; group: GroupId; tier: 'c' | 'm' | 's' | 'o'; x: number; y: number; r: number; deg: number; mentions: number }

export function layGraph() {
  const rand = rng(20261023);
  const nodes: GNode[] = PEOPLE.map(p => {
    const [cx, cy] = CENTER[p.group];
    return { id: p.id, group: p.group, tier: p.tier, x: cx + (rand() - .5) * 200, y: cy + (rand() - .5) * 200, r: R[p.tier], deg: 0, mentions: (STATS.totals[p.id] ?? 0) + (STATS.sequel?.[p.id] ?? 0) };
  });
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const links = EDGES.filter(([a, b]) => idx.has(a) && idx.has(b)).map(([a, b, type]) => ({ s: idx.get(a)!, t: idx.get(b)!, type }));
  for (const l of links) { nodes[l.s].deg++; nodes[l.t].deg++; }
  /* 主要人物按原文出场多少略放大 */
  for (const n of nodes) if (n.tier === 'c') n.r = 10 + Math.min(8, Math.sqrt(n.mentions) / 7);

  const vx = new Float64Array(nodes.length), vy = new Float64Array(nodes.length);
  const STEPS = 700;
  for (let step = 0; step < STEPS; step++) {
    const alpha = 1 - step / STEPS;
    /* 排斥 */
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = rand() - .5; dy = rand() - .5; d2 = 1; }
      const same = a.group === b.group ? 1 : 1.6;
      const f = ((a.group === 'rong' && b.group === 'rong' ? 2600 : 1500) * same * (.3 + alpha)) / d2;
      const d = Math.sqrt(d2);
      const min = a.r + b.r + (a.tier === 'c' || b.tier === 'c' ? 46 : 30);
      const push = d < min ? (min - d) * .5 : 0;
      const fx = (dx / d) * (f + push), fy = (dy / d) * (f + push);
      vx[i] -= fx; vy[i] -= fy; vx[j] += fx; vy[j] += fy;
    }
    /* 关系的弹簧，同族短一些 */
    for (const l of links) {
      const a = nodes[l.s], b = nodes[l.t];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const rest = a.group === b.group ? 90 : 180;
      const k = (a.group === b.group ? .05 : .012) * alpha;
      const f = (d - rest) * k;
      vx[l.s] += (dx / d) * f; vy[l.s] += (dy / d) * f;
      vx[l.t] -= (dx / d) * f; vy[l.t] -= (dy / d) * f;
    }
    /* 岛心引力 */
    nodes.forEach((n, i) => {
      const [cx, cy] = CENTER[n.group];
      vx[i] += (cx - n.x) * .02 * (.4 + alpha);
      vy[i] += (cy - n.y) * .02 * (.4 + alpha);
      n.x += vx[i] * .5; n.y += vy[i] * .5;
      vx[i] *= .6; vy[i] *= .6;
    });
  }
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const pad = 80;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, maxX = Math.max(...xs) + pad, maxY = Math.max(...ys) + pad;
  for (const n of nodes) { n.x = +(n.x - minX).toFixed(1); n.y = +(n.y - minY).toFixed(1); }
  /* 岛名写在每族的重心上方 */
  const islands = (Object.keys(CENTER) as GroupId[]).map(g => {
    const ms = nodes.filter(n => n.group === g);
    const x = ms.reduce((a, n) => a + n.x, 0) / ms.length, y = Math.min(...ms.map(n => n.y));
    const rad = Math.max(...ms.map(n => Math.hypot(n.x - x, n.y - ms.reduce((a, m) => a + m.y, 0) / ms.length))) + 40;
    return { g, x: +x.toFixed(1), y: +(y - 34).toFixed(1), cy: +(ms.reduce((a, n) => a + n.y, 0) / ms.length).toFixed(1), rad: +rad.toFixed(1) };
  });
  return { W: Math.round(maxX - minX), H: Math.round(maxY - minY), nodes, links, islands };
}
