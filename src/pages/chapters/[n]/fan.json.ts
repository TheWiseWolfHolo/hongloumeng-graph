/* 竖排时整回换成繁体。只列出和简体不同的那些字：at 是它们在全文文字里的位置（第一个是绝对位置，之后是和上一个的间隔），
   ch 是换上去的字。全文文字按 HTML 里文本节点的先后连起来，和浏览器里的顺序一致，客户端逐个文本节点换掉就行。 */
import type { APIRoute } from 'astro';
import { CHAPTERS } from '../../../lib/data.ts';
import { loadChapter, renderChapter } from '../../../lib/render-text.ts';
import { toTrad } from '../../../lib/kanben.ts';

export function getStaticPaths() {
  return CHAPTERS.map(c => ({ params: { n: String(c.n) } }));
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"' };
const unesc = (s: string) => s.replace(/&(amp|lt|gt|quot);/g, (_, k) => ENT[k]);

export const GET: APIRoute = ({ params }) => {
  const segs = renderChapter(loadChapter(Number(params.n))).split(/<[^>]*>/).map(unesc);
  const at: number[] = [];
  let ch = '', pos = 0, last = 0;
  for (const s of segs) {
    /* 一段一段转，转换前后长度不一致的那段就不动 */
    const t = toTrad(s);
    for (let i = 0; i < s.length; i++) if (t[i] !== s[i]) { at.push(pos + i - last); last = pos + i; ch += t[i]; }
    pos += s.length;
  }
  return new Response(JSON.stringify({ at, ch }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
