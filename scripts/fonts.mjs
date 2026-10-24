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
import { spread } from '../src/lib/kanben.ts';
import { PEOPLE } from '../src/data/people.ts';
import { TWELVE, TWELVE_MORE } from '../src/data/twelve.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.fonts-cache');
const outRoot = join(root, 'public', 'fonts');
mkdirSync(cache, { recursive: true });
const force = process.argv.includes('--force');
const python = process.env.PYTHON || 'python';

const FONTS = [
  {
    key: 'serif', family: 'HLM Serif', file: 'NotoSerifSC[wght].ttf', weight: '200 900',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf'
  },
  {
    /* 齐伋体，取自明代闵齐伋刻本的木刻宋体，标题、引文、批语都用它；简体字也映射到它的繁体字形上。字身偏上，用 metrics 按字面中心重设上下高度，按钮和印章里的单字才能上下居中 */
    key: 'qiji', family: 'HLM Qiji', file: 'qiji-combo.ttf', weight: '400', metrics: 'ascent-override:79%;descent-override:21%;', hanOnly: true, clean: 'scripts/qiji-clean.py',
    url: 'https://github.com/LingDong-/qiji-font/releases/download/0.0.4/qiji-combo.ttf'
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
const frequency = new Map();
const bookFrequency = new Map();
const count = (s, into) => { for (const ch of s) into.set(ch, (into.get(ch) ?? 0) + 1); };
/* 首页与公共控件的字先放在一起，只读这些界面的文案，不把人物生平和全书正文放进来。 */
const uiFrequency = new Map();
const uiSources = [
  'components/Header.astro', 'components/Footer.astro', 'components/TitleSlip.astro',
  'components/InkRiver.astro', 'components/Kanben.astro', 'pages/index.astro',
  'client/site.ts', 'client/kanben/book.ts', 'lib/cn.ts'
];
for (const file of uiSources) {
  const source = readFileSync(join(root, 'src', file), 'utf8')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  count([...source].filter(ch => /\p{Script=Han}/u.test(ch)).join(''), uiFrequency);
}
for (const person of PEOPLE.filter(p => p.tier === 'c')) count(person.id, uiFrequency);
const totals = JSON.parse(readFileSync(join(root, 'src/data/derived/stats.json'), 'utf8')).totals;
const people = new Map(PEOPLE.map(p => [p.id, p]));
for (const [id] of Object.entries(totals).filter(([id]) => people.get(id).tier !== 'o').sort((a, b) => b[1] - a[1]).slice(0, 14)) count(id, uiFrequency);
for (const verse of [...TWELVE, ...TWELVE_MORE]) count(verse.verse.slice(-2).join(''), uiFrequency);
/* 首页刻本页把原文转成繁体（src/lib/kanben.ts），转出来的字也要收 */
{
  const { Converter } = await import('opencc-js');
  const s2t = Converter({ from: 'cn', to: 't' });
  const dir = join(root, 'src', 'data', 'text');
  for (const name of readdirSync(dir)) {
    const raw = readFileSync(join(dir, name), 'utf8');
    const traditional = s2t(raw);
    for (const ch of traditional) chars.add(ch);
    count(raw + traditional, frequency);
  }
  for (let n = 1; n <= 120; n++) {
    const sp = spread(n);
    count(sp.cells.map(x => x[2]).join('') + sp.mei.map(x => x[1]).join('') + (sp.back ?? []).map(x => x[2]).join(''), bookFrequency);
  }
}
/* 常用标点和 ASCII 全收，搜索框里也可能输入 */
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCodePoint(c));
for (const ch of '，。、；：？！“”‘’（）《》〈〉【】—…·「」『』〔〕｜～０１２３４５６７８９') chars.add(ch);
const text = [...chars].filter(ch => ch.codePointAt(0) >= 0x20).sort().join('');
const textHash = createHash('sha1').update(text).digest('hex').slice(0, 10);

/* 界面文案按六十四个码点分包，避免少量标签拉取整包正文。
   刻本和正文另按频率分包，固定分组保留原字形和字重。 */
function subsetsFor(f) {
  const available = [...text].filter(ch => !f.hanOnly || /\p{Script=Han}/u.test(ch));
  const ui = available.filter(ch => uiFrequency.has(ch)).sort((a, b) => (uiFrequency.get(b) - uiFrequency.get(a)) || a.codePointAt(0) - b.codePointAt(0));
  const ordered = available.filter(ch => !uiFrequency.has(ch)).sort((a, b) =>
    (f.key === 'qiji' ? (bookFrequency.get(b) ?? 0) - (bookFrequency.get(a) ?? 0) : 0)
    || (frequency.get(b) ?? 0) - (frequency.get(a) ?? 0)
    || a.codePointAt(0) - b.codePointAt(0));
  const subsets = [];
  for (let i = 0; i < ui.length; i += 64) subsets.push(ui.slice(i, i + 64).map(ch => ch.codePointAt(0)));
  for (let i = 0; i < ordered.length; i += 128) subsets.push(ordered.slice(i, i + 128).map(ch => ch.codePointAt(0)));
  return subsets;
}

async function source(f) {
  const p = join(cache, f.file);
  if (existsSync(p)) return p;
  console.log('下载', f.file);
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`${f.file} 下载失败 ${res.status}`);
  if (!f.zip) { writeFileSync(p, Buffer.from(await res.arrayBuffer())); return p; }
  const zp = p + '.zip';
  writeFileSync(zp, Buffer.from(await res.arrayBuffer()));
  const unzip = 'import zipfile,sys,os; z=zipfile.ZipFile(sys.argv[1]); m=[n for n in z.namelist() if os.path.basename(n)==sys.argv[2]][0]; open(sys.argv[3],"wb").write(z.read(m))';
  execFileSync(python, ['-c', unzip, zp, f.file, p]);
  rmSync(zp);
  return p;
}

const textFile = join(cache, 'chars.txt');
writeFileSync(textFile, text);
let rebuilt = false;
for (const f of FONTS) {
  const out = join(outRoot, f.key);
  const stamp = join(out, '.stamp');
  const subsets = subsetsFor(f);
  const groupHash = createHash('sha1').update(JSON.stringify(subsets)).digest('hex').slice(0, 10);
  const cleanHash = f.clean ? createHash('sha1').update(readFileSync(join(root, f.clean))).digest('hex').slice(0, 10) : '';
  const subsetWant = `${f.file}|${textHash}|${f.hanOnly ? 'han' : 'all'}|${cleanHash}`;
  const want = `${subsetWant}|ui64-frequency128-v2|${groupHash}`;
  if (!force && existsSync(stamp) && readFileSync(stamp, 'utf8') === want && existsSync(join(outRoot, 'fonts.css'))) { console.log(f.key, '没有新字，跳过'); continue; }
  rebuilt = true;
  let src = await source(f);
  /* 扫描字形里带着邻字残笔的先洗掉，大小不匀的按配套的规整字体统一 */
  if (f.clean) {
    const c = join(cache, f.key + '.clean.ttf');
    const cleanStamp = join(cache, f.key + '.clean.stamp');
    if (!existsSync(c) || !existsSync(cleanStamp) || readFileSync(cleanStamp, 'utf8') !== cleanHash) {
      const rel = 'https://github.com/LingDong-/qiji-font/releases/download/0.0.4/';
      const pure = await source({ file: 'qiji.ttf', url: rel + 'qiji.ttf' });
      const ref = await source({ file: 'qiji-fallback.ttf', url: rel + 'qiji-fallback.ttf' });
      execFileSync(python, [join(root, f.clean), src, c, pure, ref], { stdio: 'inherit' });
      writeFileSync(cleanStamp, cleanHash);
    }
    src = c;
  }
  const sub = join(cache, `${f.key}.subset.ttf`);
  const subsetStamp = join(cache, `${f.key}.subset.stamp`);
  /* 齐伋体只收汉字：它的标点和西文字形窄，混排时逗号像半角；标点、数字一律落回思源宋体 */
  let tf = textFile;
  if (f.hanOnly) { tf = join(cache, `${f.key}.chars.txt`); writeFileSync(tf, [...text].filter(ch => /\p{Script=Han}/u.test(ch)).join('')); }
  if (force || !existsSync(sub) || !existsSync(subsetStamp) || readFileSync(subsetStamp, 'utf8') !== subsetWant) {
    execFileSync(python, ['-m', 'fontTools.subset', src, `--text-file=${tf}`, `--output-file=${sub}`,
      '--layout-features=*', '--no-hinting', '--desubroutinize'], { stdio: 'inherit' });
    writeFileSync(subsetStamp, subsetWant);
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await fontSplit({
    input: new Uint8Array(readFileSync(sub)),
    subsets, autoSubset: false, languageAreas: false, reduceMins: false,
    outDir: out,
    css: { fontFamily: f.family, fontWeight: f.weight, fontDisplay: 'swap', localFamily: [], compress: true },
    testHtml: false, reporter: false, silent: true,
    renameOutputFont: '[hash:8].[ext]'
  });
  writeFileSync(stamp, want);
  const files = readdirSync(out).filter(n => n.endsWith('.woff2'));
  const size = files.reduce((a, n) => a + statSync(join(out, n)).size, 0);
  console.log(f.key, `${files.length} 包，共 ${(size / 1024 / 1024).toFixed(2)} MB，收字 ${[...text].length}`);
}

/* 几份字体样式合成一份，去掉生成器的注释，路径改成从 /fonts/ 起算 */
if (rebuilt) {
  let css = '';
  for (const f of FONTS) {
    const resCss = join(outRoot, f.key, 'result.css');
    const raw = readFileSync(resCss, 'utf8');
    css += raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("\.\/([^"]+)"\)/g, `url("/fonts/${f.key}/$1")`).replace(/src:local\("[^"]*"\),/g, 'src:').trim()
      .replace(/font-weight:400;/g, `font-weight:400;${f.metrics ?? ''}`) + '\n';
    rmSync(resCss, { force: true });
    rmSync(join(outRoot, f.key, 'index.proto'), { force: true });
  }
  writeFileSync(join(outRoot, 'fonts.css'), css);
  console.log('fonts.css', (css.length / 1024).toFixed(0), 'KB');
}
/* cn-font-split 的原生库在进程自然退出时会崩，写完直接退出 */
process.exit(0);
