// 自托管字体：先按站里实际用到的字裁掉用不到的字形，再切成按 unicode-range 分包的 woff2，
// 浏览器只下载当前页面用到的那几包。输出到 public/fonts/<名字>/，构建时随 public 一起拷进 dist。
// 依赖 Python 的 fonttools（pip install fonttools brotli）。源字体第一次运行时下载到 .fonts-cache/。
// 用法 node scripts/fonts.mjs [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fontSplit } from 'cn-font-split';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.fonts-cache');
const outRoot = join(root, 'public', 'fonts');
mkdirSync(cache, { recursive: true });
const force = process.argv.includes('--force');

const FONTS = [
  {
    key: 'serif', family: 'HLM Serif', file: 'NotoSerifSC[wght].ttf', weight: '200 900',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf'
  },
  {
    key: 'kai', family: 'HLM Kai', file: 'LXGWWenKai-Regular.ttf', weight: '400',
    url: 'https://github.com/lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Regular.ttf'
  },
  {
    key: 'brush', family: 'HLM Brush', file: 'MaShanZheng-Regular.ttf', weight: '400',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf'
  }
];

/* 收集 src/ 下所有文字：原文、数据、组件里的文案都在这里 */
function collect(dir, set) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { collect(p, set); continue; }
    if (!['.ts', '.astro', '.json', '.css', '.js', '.md'].includes(extname(p))) continue;
    for (const ch of readFileSync(p, 'utf8')) set.add(ch);
  }
}
const chars = new Set();
collect(join(root, 'src'), chars);
/* 常用标点和 ASCII 全收，搜索框里也可能输入 */
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCodePoint(c));
for (const ch of '，。、；：？！“”‘’（）《》〈〉【】—…·「」『』〔〕｜～０１２３４５６７８９') chars.add(ch);
const text = [...chars].filter(ch => ch.codePointAt(0) >= 0x20).sort().join('');
const textHash = createHash('sha1').update(text).digest('hex').slice(0, 10);

async function source(f) {
  const p = join(cache, f.file);
  if (existsSync(p)) return p;
  console.log('下载', f.file);
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`${f.file} 下载失败 ${res.status}`);
  writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  return p;
}

const textFile = join(cache, 'chars.txt');
writeFileSync(textFile, text);
for (const f of FONTS) {
  const out = join(outRoot, f.key);
  const stamp = join(out, '.stamp');
  const want = `${f.file}|${textHash}`;
  if (!force && existsSync(stamp) && readFileSync(stamp, 'utf8') === want) { console.log(f.key, '没有新字，跳过'); continue; }
  const src = await source(f);
  const sub = join(cache, `${f.key}.subset.ttf`);
  execFileSync('python', ['-m', 'fontTools.subset', src, `--text-file=${textFile}`, `--output-file=${sub}`,
    '--layout-features=*', '--no-hinting', '--desubroutinize'], { stdio: 'inherit' });
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await fontSplit({
    input: new Uint8Array(readFileSync(sub)),
    outDir: out,
    css: { fontFamily: f.family, fontWeight: f.weight, fontDisplay: 'swap', localFamily: [], compress: true },
    testHtml: false, reporter: false, silent: true,
    chunkSize: 60 * 1024,
    renameOutputFont: '[hash:8].[ext]'
  });
  writeFileSync(stamp, want);
  const files = readdirSync(out).filter(n => n.endsWith('.woff2'));
  const size = files.reduce((a, n) => a + statSync(join(out, n)).size, 0);
  console.log(f.key, `${files.length} 包，共 ${(size / 1024 / 1024).toFixed(2)} MB，收字 ${[...text].length}`);
}

/* 三份字体样式合成一份，去掉生成器的注释，路径改成从 /fonts/ 起算 */
let css = '';
for (const f of FONTS) {
  const raw = readFileSync(join(outRoot, f.key, 'result.css'), 'utf8');
  css += raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("\.\/([^"]+)"\)/g, `url("/fonts/${f.key}/$1")`).replace(/src:local\("[^"]*"\),/g, 'src:').trim() + '\n';
}
writeFileSync(join(outRoot, 'fonts.css'), css);
console.log('fonts.css', (css.length / 1024).toFixed(0), 'KB');
/* cn-font-split 的原生库在进程自然退出时会崩，写完直接退出 */
process.exit(0);
