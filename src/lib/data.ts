/* 页面共用的数据查询。所有页面都在构建时调用，结果写进静态 HTML。 */
import { PEOPLE, GROUPS, BOOKS, type Person, type GroupId } from '../data/people.ts';
import { EDGES, REL_TYPES, type RelType } from '../data/relations.ts';
import { EVENTS, type StoryEvent } from '../data/events.ts';
import { SUMMARIES } from '../data/summaries.ts';
import { GARDEN } from '../data/garden.ts';
import { TWELVE, TWELVE_MORE } from '../data/twelve.ts';
import chaptersJson from '../data/chapters.json';
import mentionsJson from '../data/derived/mentions.json';
import statsJson from '../data/derived/stats.json';
import notesJson from '../data/derived/notes.json';
import { plainName } from './names.ts';

export { PEOPLE, GROUPS, BOOKS, EDGES, REL_TYPES, EVENTS, GARDEN, TWELVE, TWELVE_MORE };
export type { Person, GroupId, RelType, StoryEvent };

export const byId = new Map(PEOPLE.map(p => [p.id, p]));
export const person = (id: string) => {
  const p = byId.get(id);
  if (!p) throw new Error(`人物库里没有 ${id}`);
  return p;
};
export const has = (id: string) => byId.has(id);

export const personUrl = (id: string) => `/people/${id}/`;
export const chapterUrl = (n: number) => `/chapters/${n}/`;
export const groupColor = (g: GroupId) => `var(--g-${g})`;

const NUM = '零一二三四五六七八九';
export function cn(n: number): string {
  if (n <= 10) return n === 10 ? '十' : NUM[n];
  if (n < 20) return '十' + (n % 10 ? NUM[n % 10] : '');
  if (n < 100) return NUM[Math.floor(n / 10)] + '十' + (n % 10 ? NUM[n % 10] : '');
  const r = n - 100;
  return '一百' + (r === 0 ? '' : r < 10 ? '零' + NUM[r] : r < 20 ? '一十' + (r % 10 ? NUM[r % 10] : '') : cn(r));
}
export const huiName = (n: number) => `第${cn(n)}回`;
/* 回目范围写成“第三十三至三十四回” */
export function huiRange(c: number[]): string {
  if (c.length === 1 || c[0] === c[1]) return huiName(c[0]);
  return `第${cn(c[0])}至${cn(c[1])}回`;
}

/* ---- 别称 ---- */
export function namesOf(p: Person): string[] {
  const seen = new Set([p.id]);
  const out: string[] = [];
  for (const n of [...(p.names ?? []), ...(p.alias ?? [])].map(plainName)) {
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

/* ---- 关系：从某人这边看，对方是他的什么人 ---- */
export interface Tie { other: string; type: RelType; role: string; note?: string }
export function tiesOf(id: string): Tie[] {
  const out: Tie[] = [];
  for (const [a, b, type, label, note] of EDGES) {
    if (a !== id && b !== id) continue;
    const [p, q] = label.includes('/') ? label.split('/') : [label, label];
    out.push(a === id ? { other: b, type, role: q, note } : { other: a, type, role: p, note });
  }
  return out;
}
export const TYPE_ORDER: RelType[] = ['b', 'm', 'in', 'lv', 'my', 'sv', 'fr', 'ri'];

/* ---- 回目 ---- */
export interface Chapter { n: number; cn: string; title: string[]; chars: number; notes: number; summary: string }
export const CHAPTERS: Chapter[] = (chaptersJson as Omit<Chapter, 'summary'>[]).map(c => ({ ...c, summary: SUMMARIES[c.n] ?? '' }));
export const chapter = (n: number) => CHAPTERS[n - 1];
export const TOTAL_CHARS = CHAPTERS.reduce((a, c) => a + c.chars, 0);
export const TOTAL_NOTES = CHAPTERS.reduce((a, c) => a + c.notes, 0);
/* 前八十回是曹雪芹原作，后四十回是续书 */
export const isSequel = (n: number) => n > 80;

export const eventsOf = (id: string) => EVENTS.filter(e => e.ids.includes(id));
export const eventsIn = (n: number) => EVENTS.filter(e => n >= e.c[0] && n <= (e.c[1] ?? e.c[0]));

/* ---- 原文统计 ---- */
export const MENTIONS = mentionsJson as Record<string, number[]>;
/* totals 只算前八十回，sequel 是续书四十回里的次数 */
export const STATS = statsJson as {
  totals: Record<string, number>;
  sequel: Record<string, number>;
  firstSeen: Record<string, { n: number; block: number; text: string }>;
  companions: Record<string, [string, number][]>;
  topPairs: [string, string, number][];
};
/* 脂批里点到某人的批语，挑过的十来条 */
export interface ZhiNote { n: number; block: number; src: string[]; kind: string; s: string; ctx: string }
export const NOTES = notesJson as Record<string, { total: number; top: ZhiNote[] }>;
/* 批语出处的全称 */
export const SRC_NAME: Record<string, string> = { 甲戌: '甲戌本', 庚辰: '庚辰本', 己卯: '己卯本', 蒙府: '蒙府本', 戚序: '戚序本', 靖藏: '靖藏本', 梦稿: '梦稿本', 列藏: '列藏本', 甲辰: '甲辰本', 舒序: '舒序本' };
export const noteLabel = (x: { src: string[]; kind: string }) => {
  const kind = x.kind === '回前' ? '回前批' : x.kind === '回后' ? '回后批' : x.kind;
  return x.src.length ? `${x.src.join('、')}${kind}` : kind === '批' ? '脂批' : kind;
};

/* 某回里提到最多的人 */
export function castOf(n: number, limit = 40): [string, number][] {
  return PEOPLE.map(p => [p.id, MENTIONS[p.id]?.[n - 1] ?? 0] as [string, number])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}
/* 第一回和最后一回出场 */
export function spanOf(id: string): [number, number] | null {
  const m = MENTIONS[id];
  if (!m) return null;
  const first = m.findIndex(v => v > 0);
  if (first < 0) return null;
  let last = m.length - 1;
  while (last > 0 && !m[last]) last--;
  return [first + 1, last + 1];
}

/* ---- 其他 ---- */
export const homesOf = (id: string) => GARDEN.filter(g => g.kind === 'home' && g.who.includes(id));
export const verseOf = (id: string) => [...TWELVE, ...TWELVE_MORE].find(v => v.ids.includes(id));
export const RANK: Record<string, number> = { c: 0, m: 1, o: 2, s: 3 };

/* 按家族排好的人物，组内核心人物在前 */
export const GROUP_ORDER: GroupId[] = ['rong', 'ning', 'shi', 'wang', 'xue', 'lin', 'oth', 'out', 'myth'];
export function peopleByGroup() {
  return GROUP_ORDER.map(g => ({ g, info: GROUPS[g], list: PEOPLE.filter(p => p.group === g).sort((a, b) => RANK[a.tier] - RANK[b.tier]) }));
}

