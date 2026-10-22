/* 搜索面板用的索引：人物、回目、园中院落和大事，打开面板时才去取 */
import { PEOPLE, CHAPTERS, GARDEN, EVENTS, namesOf, STATS } from '../lib/data.ts';

export function GET() {
  const body = {
    p: PEOPLE.map(p => [p.id, p.group, p.tier, p.title, namesOf(p).join(' '), STATS.totals[p.id] ?? 0]),
    c: CHAPTERS.map(c => [c.n, c.cn, c.title[0], c.title[1]]),
    g: GARDEN.map(g => [g.id, g.name, g.alias]),
    e: EVENTS.map(e => [e.t, e.c[0], e.c[1] ?? e.c[0], e.s])
  };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}
