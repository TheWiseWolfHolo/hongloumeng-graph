/* 全书原文，一回一个字符串，只在搜索原文时才下载 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function GET() {
  const dir = join(process.cwd(), 'src', 'data', 'text');
  const out: string[] = [];
  for (let n = 1; n <= 120; n++) {
    const d = JSON.parse(readFileSync(join(dir, `${String(n).padStart(3, '0')}.json`), 'utf8'));
    /* 单独成段的脂批不进搜索，只搜正文 */
    out.push(d.blocks.filter((b: { t: string }) => b.t !== 'pi').map((b: { s: string }) => b.s).join('\n'));
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } });
}
