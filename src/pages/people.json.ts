/* 人物悬停卡用的简表：[分组, 称号, 简介, 分组名, 画像小图] */
import { PEOPLE, GROUPS } from '../lib/data.ts';
import { portraitThumb } from '../lib/portraits.ts';

export async function GET() {
  const rows = await Promise.all(PEOPLE.map(async p => [p.id, [p.group, p.title, p.bio, GROUPS[p.group].name, await portraitThumb(p.portrait, 160)]]));
  return new Response(JSON.stringify(Object.fromEntries(rows)), { headers: { 'content-type': 'application/json' } });
}
