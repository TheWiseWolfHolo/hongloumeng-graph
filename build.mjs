// 把 src/ 合成单文件 index.html(完整文档),并可选输出去掉文档骨架的发布版片段。
// 用法 node build.mjs [片段输出路径]
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const src = f => readFileSync(join(dir, 'src', f), 'utf8');
const js = ['data-people.js', 'data-extra.js', 'data-events.js', 'core.js', 'graph.js', 'tree.js', 'pages.js', 'garden.js', 'timeline.js', 'main.js'].map(src).join('\n');
const css = src('style.css');
const body = src('body.html');
const title = '红楼梦人物关系图谱';
const fonts = 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Sans+SC:wght@300..900&family=Noto+Serif+SC:wght@300..900&display=swap';

writeFileSync(join(dir, '.bundle.check.js'), js);
execFileSync(process.execPath, ['--check', join(dir, '.bundle.check.js')], { stdio: 'inherit' });

/* 独立网页用的描述、分享卡片和图标;人数与关系数直接从数据里数 */
const [nPeople, nRel] = new Function(src('data-people.js') + '\nreturn [NODES.length, EDGES.length];')();
const desc = `《红楼梦》人物关系图谱:${nPeople} 位人物、${nRel} 条关系。可拖动的关系星图与命盘、贾府世系、四大家族、金陵十二钗判词、大观园地图与百二十回大事。`;
const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="9" fill="#a8271d"/><rect x="6.5" y="6.5" width="51" height="51" rx="3" fill="none" stroke="#f6e7cf" stroke-width="2.6"/><text x="32" y="45" font-size="34" text-anchor="middle" fill="#f6e7cf" font-family="serif" font-weight="700">红</text></svg>';
const meta = [
  `<meta name="description" content="${desc}">`,
  '<meta name="theme-color" content="#7f1b17">',
  '<meta property="og:type" content="website">',
  `<meta property="og:title" content="${title}">`,
  `<meta property="og:description" content="${desc}">`,
  '<meta property="og:locale" content="zh_CN">',
  `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">`
].join('\n');
const head = `<title>${title}</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${fonts}">\n<style>\n${css}\n</style>`;
const tail = `<script>\n${js}\n</script>`;
const full = `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${meta}\n${head}\n</head>\n<body>\n${body}\n${tail}\n</body>\n</html>\n`;
writeFileSync(join(dir, 'index.html'), full);
console.log('index.html', (full.length / 1024).toFixed(0) + ' KB');
if (process.argv[2]) {
  writeFileSync(process.argv[2], `${head}\n${body}\n${tail}\n`);
  console.log('fragment ->', process.argv[2]);
}
import('node:fs').then(fs => fs.unlinkSync(join(dir, '.bundle.check.js')));
