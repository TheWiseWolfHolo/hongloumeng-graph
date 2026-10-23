/* 全站共用的交互：主题、页头、目录、搜索面板、阅读进度、渐显、人物悬停卡 */

const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s as any) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(s as any)) as T[];
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string | null) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 隐私模式下存不了，不影响浏览 */ } }
};
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
import { cn } from '../lib/cn.ts';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 主题 ---------- */
$('[data-theme-toggle]')?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  const apply = () => { document.documentElement.dataset.theme = next; store.set('hlm-theme', next); };
  const vt = (document as any).startViewTransition;
  if (vt && !reduced) vt.call(document, apply); else apply();
});

/* ---------- 页头：一直钉在顶上，不随滚动伸缩；离开页首后底下加一道细影 ---------- */
const header = $('[data-header]');
const lift = () => header?.classList.toggle('lifted', scrollY > 8);
addEventListener('scroll', lift, { passive: true });
lift();

/* ---------- 手机目录 ---------- */
const menu = $('[data-menu]');
const menuBtn = $('[data-menu-open]');
function setMenu(open: boolean) {
  if (!menu) return;
  menu.hidden = !open;
  document.body.classList.toggle('menu-lock', open);
  menuBtn?.setAttribute('aria-expanded', String(open));
  if (open) $('a', menu)?.focus(); else menuBtn?.focus();
}
menuBtn?.addEventListener('click', () => setMenu(true));
$('[data-menu-close]')?.addEventListener('click', () => setMenu(false));
addEventListener('keydown', e => { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false); });

/* ---------- 渐显 ---------- */
export function observeReveal(root: ParentNode = document) {
  const els = $$('.reveal:not(.in)', root);
  if (!('IntersectionObserver' in window) || reduced) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  els.forEach(el => io.observe(el));
}
observeReveal();

/* ---------- 阅读进度（防剧透） ---------- */
const progDlg = $<HTMLDialogElement>('[data-progress]');
const progRange = $<HTMLInputElement>('[data-prog-range]');
const progOut = $('[data-prog-out]');
const badge = $('[data-progress-badge]');
const cnNum = (n: number) => {
  const D = '零一二三四五六七八九';
  if (n <= 10) return n === 10 ? '十' : D[n];
  if (n < 20) return '十' + (n % 10 ? D[n % 10] : '');
  if (n < 100) return D[Math.floor(n / 10)] + '十' + (n % 10 ? D[n % 10] : '');
  const r = n - 100;
  return '一百' + (r === 0 ? '' : r < 10 ? '零' + D[r] : r < 20 ? '一十' + (r % 10 ? D[r % 10] : '') : cnNum(r).replace(/^一百/, ''));
};
export function progress(): number { return +(document.documentElement.dataset.progress || 0); }
export function applyGuard(root: ParentNode = document) {
  const p = progress();
  for (const el of $$('.spoil[data-ch]', root)) {
    const ch = +el.dataset.ch!;
    el.classList.toggle('ahead', p > 0 && ch > p && !el.dataset.opened);
    if (!$('.spoil-tip', el)) {
      const tip = document.createElement('div');
      tip.className = 'spoil-tip';
      tip.innerHTML = `<span>第${cnNum(ch)}回的内容，你还没读到</span><button type="button">仍要看</button>`;
      tip.querySelector('button')!.addEventListener('click', () => { el.dataset.opened = '1'; el.classList.remove('ahead'); });
      el.append(tip);
    }
  }
  if (badge) { badge.hidden = !p; badge.textContent = p ? String(p) : ''; }
}
function setProgress(p: number) {
  const d = document.documentElement;
  if (p > 0 && p < 120) { d.dataset.progress = String(p); d.classList.add('guard'); store.set('hlm-progress', String(p)); }
  else { delete d.dataset.progress; d.classList.remove('guard'); store.set('hlm-progress', null); }
  applyGuard();
  dispatchEvent(new CustomEvent('hlm:progress', { detail: progress() }));
}
const showOut = () => { if (progOut && progRange) progOut.textContent = +progRange.value >= 120 ? '全书' : `第${cnNum(+progRange.value)}回`; };
progRange?.addEventListener('input', showOut);
$('[data-progress-open]')?.addEventListener('click', () => {
  if (progRange) progRange.value = String(progress() || 120);
  showOut();
  progDlg?.showModal();
});
$('[data-prog-save]')?.addEventListener('click', () => setProgress(+(progRange?.value || 120)));
$('[data-prog-off]')?.addEventListener('click', () => { setProgress(0); progDlg?.close(); });
progDlg?.addEventListener('click', e => { if (e.target === progDlg) progDlg.close(); });
applyGuard();

/* ---------- 搜索面板 ---------- */
type PRow = [string, string, string, string, string, number];
interface Index { p: PRow[]; c: [number, string, string, string][]; g: [string, string, string][]; e: [string, number, number, string][] }
const pal = $<HTMLDialogElement>('[data-palette]');
const palQ = $<HTMLInputElement>('[data-pal-q]');
const palList = $('[data-pal-list]');
let index: Index | null = null;
let fullText: string[] | null = null;
let fullTextLoading: Promise<void> | null = null;
let sel = 0;
let items: { href: string; el: HTMLElement }[] = [];
const SEAL: Record<string, string> = { rong: '荣', ning: '宁', shi: '史', wang: '王', xue: '薛', lin: '林', oth: '亲', out: '外', myth: '幻' };
const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const mark = (s: string, q: string) => {
  const i = s.indexOf(q);
  return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
};
/* “第二十七回”“27”“二十七回”都认作回目 */
const CN_D: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function parseHui(q: string): number | null {
  const m = /^第?([0-9]+|[零〇一二两三四五六七八九十百]+)回?$/.exec(q);
  if (!m) return null;
  if (/^\d+$/.test(m[1])) { const n = +m[1]; return n >= 1 && n <= 120 ? n : null; }
  let s = m[1], n = 0;
  if (s.startsWith('一百')) { n = 100; s = s.slice(2).replace(/^零/, ''); if (s.startsWith('一十')) s = s.slice(1); }
  if (s.includes('十')) { const [a, b] = s.split('十'); n += (a ? CN_D[a] : 1) * 10 + (b ? CN_D[b] ?? 0 : 0); }
  else if (s) n += CN_D[s] ?? NaN;
  return n >= 1 && n <= 120 ? n : null;
}
async function loadIndex() {
  if (index) return;
  index = await (await fetch('/search.json')).json();
}
function loadFullText() {
  fullTextLoading ??= fetch('/text.json').then(r => r.json()).then(t => { fullText = t; });
  return fullTextLoading;
}
function render() {
  if (!palList || !index || !palQ) return;
  const raw = palQ.value.trim();
  const q = norm(raw);
  const out: string[] = [];
  items = [];
  const push = (html: string, href: string) => { out.push(`<a class="pal-item" role="option" href="${href}" data-i="${items.length}">${html}</a>`); items.push({ href, el: null as any }); };
  const section = (t: string) => out.push(`<div class="pal-sec">${t}</div>`);
  const RANK: Record<string, number> = { c: 0, m: 1, o: 2, s: 3 };
  /* 人物 */
  const people = (q ? index.p.map(p => {
    const names = p[4].split(' ').map(norm);
    const id = norm(p[0]);
    const score = id === q ? 0 : names.includes(q) ? 1 : id.includes(q) ? 2 : names.some(n => n.includes(q)) ? 3 : norm(p[3]).includes(q) ? 4 : 9;
    return { p, score };
  }).filter(x => x.score < 9).sort((a, b) => a.score - b.score || RANK[a.p[2]] - RANK[b.p[2]] || b.p[5] - a.p[5]) : index.p.filter(p => p[2] === 'c').map(p => ({ p, score: 0 })).sort((a, b) => b.p[5] - a.p[5])).slice(0, q ? 8 : 6);
  if (people.length) {
    section(q ? '人物' : '常看的人物');
    for (const { p } of people) {
      const alias = p[4].split(' ').filter(Boolean);
      const hitAlias = q && !norm(p[0]).includes(q) ? alias.find(a => norm(a).includes(q)) : '';
      push(`<span class="seal" style="--seal-bg:var(--g-${p[1]})">${SEAL[p[1]]}</span><span class="pal-main"><span class="pal-name">${mark(p[0], raw)}</span><span class="pal-sub">${hitAlias ? `也叫 ${mark(hitAlias, raw)} · ` : ''}${esc(p[3])}</span></span>`, `/people/${p[0]}/`);
    }
  }
  /* 回目 */
  const hui = parseHui(q);
  const chs = hui ? [index.c[hui - 1]] : q ? index.c.filter(c => norm(c[2] + c[3]).includes(q)).slice(0, 6) : [];
  if (chs.length) {
    section('回目');
    for (const c of chs) push(`<span class="pal-hui">${c[1]}</span><span class="pal-main"><span class="pal-name">${mark(c[2], raw)}　${mark(c[3], raw)}</span></span>`, `/chapters/${c[0]}/`);
  }
  /* 大事与院落 */
  if (q && !hui) {
    const evs = index.e.filter(e => norm(e[0] + e[3]).includes(q)).slice(0, 4);
    const places = index.g.filter(g => norm(g[1] + g[2]).includes(q)).slice(0, 3);
    if (evs.length || places.length) section('大事与园中');
    for (const g of places) push(`<span class="seal outline">园</span><span class="pal-main"><span class="pal-name">${mark(g[1], raw)}</span><span class="pal-sub">${esc(g[2])}</span></span>`, `/garden/#${g[0]}`);
    for (const e of evs) push(`<span class="pal-hui">${e[1] === e[2] ? `第${e[1]}回` : `${e[1]}–${e[2]}回`}</span><span class="pal-main"><span class="pal-name">${mark(e[0], raw)}</span></span>`, `/chapters/${e[1]}/`);
  }
  /* 原文 */
  if (raw.length >= 2 && !hui) {
    if (!fullText) {
      section('原文');
      out.push('<div class="pal-empty">正在翻原书……</div>');
      loadFullText().then(() => { if (pal?.open && palQ?.value.trim() === raw) render(); });
    } else {
      const hits: { n: number; i: number; s: string }[] = [];
      let total = 0;
      fullText.forEach((t, k) => {
        let i = t.indexOf(raw);
        while (i >= 0) {
          total++;
          if (hits.length < 24) hits.push({ n: k + 1, i, s: t });
          i = t.indexOf(raw, i + raw.length);
        }
      });
      if (hits.length) {
        section(`原文 · 共 ${total} 处`);
        for (const h of hits.slice(0, 12)) {
          const a = Math.max(0, h.i - 26), b = Math.min(h.s.length, h.i + raw.length + 40);
          const snip = (a ? '…' : '') + h.s.slice(a, b).replace(/\n/g, ' ') + (b < h.s.length ? '…' : '');
          push(`<span class="pal-hui">第${h.n}回</span><span class="pal-main"><span class="pal-quote">${mark(snip, raw)}</span></span>`, `/chapters/${h.n}/?q=${encodeURIComponent(raw)}`);
        }
      }
    }
  }
  if (!items.length && !(raw.length >= 2 && !fullText)) out.push(`<div class="pal-empty">没有找到“${esc(raw)}”。试试别称，比如“颦儿”“凤辣子”，或者回目里的字。</div>`);
  palList.innerHTML = out.join('');
  $$('.pal-item', palList).forEach((el, i) => { items[i].el = el; el.addEventListener('mousemove', () => select(i)); });
  select(0);
}
function select(i: number) {
  if (!items.length) return;
  sel = (i + items.length) % items.length;
  items.forEach((it, k) => it.el?.setAttribute('aria-selected', String(k === sel)));
  items[sel].el?.scrollIntoView({ block: 'nearest' });
}
async function openPalette(initial = '') {
  if (!pal || !palQ) return;
  if (!pal.open) pal.showModal();
  palQ.value = initial;
  palQ.focus();
  await loadIndex();
  render();
}
let timer = 0;
palQ?.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(render, 90); });
palQ?.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1); }
  else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); location.href = items[sel].href; }
});
pal?.addEventListener('click', e => { if (e.target === pal) pal.close(); });
$$('[data-search-open]').forEach(b => b.addEventListener('click', () => openPalette()));
addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openPalette(); }
});
/* 页面里的搜索框可以把字带进面板 */
$$<HTMLFormElement>('[data-search-form]').forEach(f => f.addEventListener('submit', e => {
  e.preventDefault();
  const v = (f.querySelector('input') as HTMLInputElement).value;
  openPalette(v);
}));

/* ---------- 人物悬停卡 ---------- */
let peopleMap: Record<string, [string, string, string, string, string]> | null = null;
let peek: HTMLElement | null = null;
let peekTimer = 0;
let peekFor: Element | null = null;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
async function showPeek(a: HTMLAnchorElement) {
  /* SVG 里的链接没有 pathname，统一从 href 解析 */
  const href = a.getAttribute('href') ?? (a as unknown as SVGAElement).href?.baseVal ?? '';
  const id = decodeURIComponent(new URL(href, location.href).pathname.split('/')[2] || '');
  if (!id) return;
  peopleMap ??= await (await fetch('/people.json')).json();
  const p = peopleMap![id];
  if (!p || peekFor !== a) return;
  peek ??= Object.assign(document.createElement('div'), { className: 'peek', role: 'tooltip' });
  peek.innerHTML = `<div class="peek-head">${p[4] ? `<img class="peek-img" src="${p[4]}" alt="" width="44" height="58">` : `<span class="seal" style="--s:40px;--seal-bg:var(--g-${p[0]})">${SEAL[p[0]]}</span>`}<div><div class="peek-name">${esc(id)}</div><div class="peek-title">${esc(p[1])}</div></div></div><p class="peek-bio">${esc(p[2])}</p>${p[3] ? `<p class="peek-end"><b>结局</b>${esc(p[3])}</p>` : ''}`;
  document.body.append(peek);
  const r = a.getBoundingClientRect();
  const w = peek.offsetWidth, h = peek.offsetHeight;
  let x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12);
  let y = r.bottom + 10;
  if (y + h > innerHeight - 12) y = r.top - h - 10;
  peek.style.left = x + 'px';
  peek.style.top = y + 'px';
  requestAnimationFrame(() => peek?.classList.add('show'));
}
function hidePeek() {
  clearTimeout(peekTimer);
  peekFor = null;
  peek?.classList.remove('show');
}
if (canHover) {
  document.addEventListener('pointerover', e => {
    const a = (e.target as Element).closest?.('a[data-peek]') as HTMLAnchorElement | null;
    if (!a || a === peekFor) return;
    hidePeek();
    peekFor = a;
    peekTimer = window.setTimeout(() => showPeek(a), 320);
  });
  document.addEventListener('pointerout', e => {
    const a = (e.target as Element).closest?.('a[data-peek]');
    if (a && !a.contains(e.relatedTarget as Node)) hidePeek();
  });
  addEventListener('scroll', hidePeek, { passive: true });
}

/* 窄屏上横着滚的图：年表类从右往左读，一打开先停在最右边；罗盘停在正中 */
for (const el of $$<HTMLElement>('[data-scroll-start]')) {
  const at = el.dataset.scrollStart;
  if (el.scrollWidth <= el.clientWidth) continue;
  el.scrollLeft = at === 'center' ? (el.scrollWidth - el.clientWidth) / 2 : el.scrollWidth;
}

export { $, $$, store, esc, cn };
