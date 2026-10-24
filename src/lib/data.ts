/* 页面共用的数据查询。所有页面都在构建时调用，结果写进静态 HTML。 */
import { PEOPLE, GROUPS, BOOKS, PERSON_PREVIEWS, PERSON_ENDINGS_AT, type Person, type GroupId } from '../data/people.ts';
import { EDGES, REL_TYPES, relationRevealAt, relationNoteAt, type RelType } from '../data/relations.ts';
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
export const personPreview = (p: Person) => PERSON_PREVIEWS[p.id] ?? { title: GROUPS[p.group].name, bio: '' };
export const endingAt = (p: Person, kind: 'end' | 'xu') => PERSON_ENDINGS_AT[p.id]?.[kind] ?? 121;

export { cn } from './cn.ts';
import { cn } from './cn.ts';
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
    if (/^(这一个|也有|因找|果有|我家|他们家)/.test(n)) continue;
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

/* ---- 关系：从某人这边看，对方是他的什么人 ---- */
export interface Tie { other: string; type: RelType; role: string; note?: string; revealAt: number; noteAt: number }
export function tiesOf(id: string): Tie[] {
  const out: Tie[] = [];
  for (const edge of EDGES) {
    const [a, b, type, label, note] = edge;
    if (a !== id && b !== id) continue;
    const [p, q] = label.includes('/') ? label.split('/') : [label, label];
    const firstBoth = Math.max(STATS.firstSeen[a]?.n ?? 1, STATS.firstSeen[b]?.n ?? 1);
    const revealAt = relationRevealAt(edge, firstBoth);
    const noteAt = relationNoteAt(edge, revealAt);
    out.push(a === id ? { other: b, type, role: q, note, revealAt, noteAt } : { other: a, type, role: p, note, revealAt, noteAt });
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
  companions: Record<string, [string, number, [number, number][]?][]>;
  topPairs: [string, string, number][];
};
/* 批语里点到某人的，挑过的十来条 */
export interface ZhiNote { n: number; block: number; src: string[]; kind: string; s: string; ctx: string }
export const NOTES = notesJson as Record<string, { total: number; top: ZhiNote[] }>;
/* 批语出处的全称 */
export const SRC_NAME: Record<string, string> = { 甲戌: '甲戌本', 庚辰: '庚辰本', 己卯: '己卯本', 有正: '有正本', 蒙府: '蒙府本', 戚序: '戚序本', 靖藏: '靖藏本', 梦稿: '梦稿本', 列藏: '列藏本', 甲辰: '甲辰本', 舒序: '舒序本' };
/* 批者：批语末尾署了名的才认，正文里提到某人不算。脂砚、畸笏的几种署法归成一个名字 */
const SIGNERS: [RegExp, string][] = [[/脂砚斋?/, '脂砚斋'], [/畸笏(?:叟|老人)?/, '畸笏叟'], [/梅溪/, '梅溪'], [/松斋/, '松斋'], [/棠村/, '棠村'], [/绮园/, '绮园'], [/立松轩/, '立松轩'], [/鉴堂/, '鉴堂'], [/玉蓝坡/, '玉蓝坡']];
const SIGN_RE = /(?:^|[。，！？；」』）\s]|[春夏秋冬])(脂砚斋?|畸笏(?:叟|老人)?|梅溪|松斋|棠村|绮园|立松轩|鉴堂|玉蓝坡)(?=[。！]|\s*$)/;
export function signerOf(s: string) {
  const m = SIGN_RE.exec(s);
  return m ? SIGNERS.find(([re]) => re.test(m[1]))![1] : '';
}
/* 批语的标签：哪个本子、什么位置，署了名的再写批者 */
export const noteLabel = (x: { src: string[]; kind: string; s?: string }) => {
  const kind = x.kind === '回前' ? '回前批' : x.kind === '回后' ? '回后批' : x.kind;
  const base = x.src.length ? `${x.src.join('、')}${kind}` : kind;
  const who = x.s ? signerOf(x.s) : '';
  return who ? `${base}　${who}` : base;
};

/* 某回里提到最多的人 */
export function castOf(n: number, limit = 40): [string, number][] {
  return PEOPLE.map(p => [p.id, MENTIONS[p.id]?.[n - 1] ?? 0] as [string, number])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}
/* 第一次和最后一次被原文提及 */
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
export const homesOf = (id: string) => GARDEN.filter(g => g.kind === 'home' && g.id !== 'dgl' && g.who.includes(id));
export const verseOf = (id: string) => [...TWELVE, ...TWELVE_MORE].find(v => v.ids.includes(id));
export const RANK: Record<string, number> = { c: 0, m: 1, o: 2, s: 3 };

/* 按家族排好的人物，组内核心人物在前 */
export const GROUP_ORDER: GroupId[] = ['rong', 'ning', 'shi', 'wang', 'xue', 'lin', 'oth', 'out', 'myth'];
export function peopleByGroup() {
  return GROUP_ORDER.map(g => ({ g, info: GROUPS[g], list: PEOPLE.filter(p => p.group === g).sort((a, b) => RANK[a.tier] - RANK[b.tier]) }));
}

