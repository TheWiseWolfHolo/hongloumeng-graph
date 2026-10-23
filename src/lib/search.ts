import traditionalCharacters from 'opencc-js/dict/TSCharacters';

/* 检索只归并单字，保留原文的字位，便于从结果准确跳回正文。 */
const characters = new Map<string, string>(traditionalCharacters.split('|').map((entry: string) => {
  const [from, to] = entry.split(' ');
  return [from, to] as [string, string];
}).filter(([from, to]: [string, string]) => from.length === to.length));

export const toSimplified = (s: string): string => s.replace(/./gu, ch => characters.get(ch) ?? ch);
export const normSearch = (s: string): string => toSimplified(s.normalize('NFKC')).toLowerCase().replace(/\s+/g, '');
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function highlight(s: string, q: string): string {
  const query = toSimplified(q);
  const i = query ? toSimplified(s).indexOf(query) : -1;
  return i < 0 ? escapeHtml(s) : escapeHtml(s.slice(0, i)) + '<mark>' + escapeHtml(s.slice(i, i + query.length)) + '</mark>' + escapeHtml(s.slice(i + query.length));
}

const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
export function parseHui(q: string): number | null {
  const m = /^第?([0-9]+|[零〇一二两三四五六七八九十百]+)回?$/.exec(normSearch(q));
  if (!m) return null;
  if (/^\d+$/.test(m[1])) { const n = +m[1]; return n >= 1 && n <= 120 ? n : null; }
  let s = m[1], n = 0;
  if (s.startsWith('一百')) { n = 100; s = s.slice(2).replace(/^零/, ''); if (s.startsWith('一十')) s = s.slice(1); }
  if (s.includes('十')) { const [a, b] = s.split('十'); n += (a ? digits[a] : 1) * 10 + (b ? digits[b] : 0); }
  else if (s) n += digits[s];
  return n >= 1 && n <= 120 ? n : null;
}

export type SearchPerson = [id: string, group: string, tier: string, title: string, names: string, mentions: number, previewTitle: string];
export interface SearchIndex {
  p: SearchPerson[];
  c: [n: number, name: string, first: string, second: string][];
  g: [id: string, name: string, alias: string][];
  e: [title: string, first: number, last: number, description: string][];
}
