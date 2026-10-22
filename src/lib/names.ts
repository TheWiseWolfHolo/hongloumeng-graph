/* 在原文里认人名。按位置取最长的叫法，所以“甄宝玉”不会被认成“宝玉”，
   “通灵宝玉”也不会。叫法可以写成“门子@4”或“老尼@15-16”，只在这几回里算数。 */
import { PEOPLE } from '../data/people.ts';

/* 这些词里含着人名，但说的不是人 */
const BLOCK = [
  '鸳鸯剑', '鸳鸯偶', '鸳鸯枕', '绣鸳鸯', '一对鸳鸯', '鸳鸯戏', '鸳鸯被', '鸳鸯阵', '鸳鸯带', '野鸳鸯', '鸳鸯锦', '鸳鸯扣',
  '花气袭人', '琥珀杯', '琥珀光', '琥珀色', '琥珀碗', '木板儿', '门板儿', '床板儿', '跳板儿', '紫菱洲',
  '高兴儿', '尽兴儿', '扫兴儿', '助兴儿', '黄莺儿', '老太太们', '姨太太们', '猫儿狗儿', '卧鸳鸯', '彩云易散',
  /* 下人的媳妇另是一个人 */
  '来旺家的', '来旺媳妇', '来旺妇', '旺儿家的', '旺儿媳妇', '林之孝家的', '赖大家的', '赖大媳妇', '兴儿媳妇', '李贵媳妇', '焦大媳妇'
];

export interface Hit { start: number; end: number; id: string }

interface Entry { text: string; id: string | null; lo: number; hi: number }

function build() {
  const byFirst = new Map<string, Entry[]>();
  const add = (raw: string, id: string | null) => {
    const m = /^(.+?)(?:@(\d+)(?:-(\d+))?)?$/.exec(raw)!;
    const lo = m[2] ? +m[2] : 1;
    const hi = m[3] ? +m[3] : m[2] ? +m[2] : 120;
    const e: Entry = { text: m[1], id, lo, hi };
    const list = byFirst.get(e.text[0]) ?? [];
    list.push(e);
    byFirst.set(e.text[0], list);
  };
  for (const p of PEOPLE) {
    if (p.tier === 'o') {
      for (const n of p.names ?? [p.id]) add(n, p.id);
      continue;
    }
    /* 叫法里已经限定了回目的，本名也照这个限定来 */
    const names = p.names ?? [];
    if (!names.some(n => plainName(n) === p.id)) add(p.id, p.id);
    for (const n of names) add(n, p.id);
  }
  for (const b of BLOCK) add(b, null);
  for (const list of byFirst.values()) list.sort((a, b) => b.text.length - a.text.length);
  return byFirst;
}

let dict: Map<string, Entry[]> | null = null;

/* 找出一段文字里的人名，chapter 用来套用只在某几回算数的叫法 */
export function findNames(text: string, chapter: number): Hit[] {
  dict ??= build();
  const hits: Hit[] = [];
  for (let i = 0; i < text.length;) {
    const list = dict.get(text[i]);
    let matched: Entry | undefined;
    if (list) {
      for (const e of list) {
        if (chapter < e.lo || chapter > e.hi) continue;
        if (text.startsWith(e.text, i)) { matched = e; break; }
      }
    }
    if (matched) {
      if (matched.id) hits.push({ start: i, end: i + matched.text.length, id: matched.id });
      i += matched.text.length;
    } else i++;
  }
  return hits;
}

/* 去掉“@回目”的后缀，给页面上展示和搜索用 */
export const plainName = (n: string) => n.replace(/@.*$/, '');
