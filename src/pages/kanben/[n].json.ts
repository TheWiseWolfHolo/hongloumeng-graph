/* 首页那本书每回开头的版面，构建时排好，翻到哪回取哪回 */
import type { APIRoute } from 'astro';
import { spread } from '../../lib/kanben.ts';

export function getStaticPaths() {
  return Array.from({ length: 120 }, (_, i) => ({ params: { n: String(i + 1) } }));
}

export const GET: APIRoute = ({ params }) => new Response(JSON.stringify(spread(Number(params.n))), {
  headers: { 'content-type': 'application/json; charset=utf-8' }
});
