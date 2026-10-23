/* 人物悬停卡以字段名区分分组、经历和防剧透简介。 */
import { PEOPLE, GROUPS, personPreview } from '../lib/data.ts';
import { portraitThumb } from '../lib/portraits.ts';

export interface PersonCard {
  group: string;
  groupName: string;
  title: string;
  bio: string;
  portrait: string;
  preview: { title: string; bio: string };
}

export async function GET() {
  const rows = await Promise.all(PEOPLE.map(async p => [p.id, {
    group: p.group, groupName: GROUPS[p.group].name, title: p.title, bio: p.bio,
    portrait: await portraitThumb(p.portrait, 160), preview: personPreview(p)
  } satisfies PersonCard]));
  return new Response(JSON.stringify(Object.fromEntries(rows)), { headers: { 'content-type': 'application/json' } });
}
