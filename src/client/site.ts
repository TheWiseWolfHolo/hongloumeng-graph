/* 全站共用的交互：主题、页头、目录、搜索面板、阅读进度、渐显、人物悬停卡 */

const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s as any) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(s as any)) as T[];
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string | null) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 隐私模式下存不了，不影响浏览 */ } }
};
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
import { cn } from '../lib/cn.ts';
import { normSearch, highlight, parseHui, type SearchIndex } from '../lib/search.ts';
import type { PersonCard } from '../pages/people.json.ts';
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
const progDlg = $<HTMLDialogElement>('dialog[data-progress-dialog]');
const progRange = $<HTMLInputElement>('[data-prog-range]');
const progOut = $('[data-prog-out]');
const badge = $('[data-progress-badge]');
export function progress(): number { return +(document.documentElement.dataset.progress || 0); }
export function applyGuard(root: ParentNode = document) {
  const p = progress();
  for (const el of $$('.spoil[data-ch]', root)) {
    const ch = +el.dataset.ch!;
    const ahead = p > 0 && ch > p && !el.dataset.opened;
    el.classList.toggle('ahead', Boolean(ahead));
    const body = $<HTMLElement>(':scope > .spoil-body', el);
    if (body) {
      body.inert = Boolean(ahead);
      body.hidden = Boolean(ahead);
      if (ahead) body.setAttribute('aria-hidden', 'true'); else body.removeAttribute('aria-hidden');
    }
    el.dataset.guardReady = '';
    if (!$(':scope > .spoil-tip', el)) {
      const tip = document.createElement('div');
      tip.className = 'spoil-tip';
      tip.innerHTML = `<span>${ch > 120 ? '含后文内容' : `第${cn(ch)}回的内容，你还没读到`}</span><button type="button">仍要看</button>`;
      tip.querySelector('button')!.addEventListener('click', () => {
        el.dataset.opened = '1';
        applyGuard(el.parentElement!);
        if (body) { body.tabIndex = -1; body.focus({ preventScroll: true }); }
      });
      el.append(tip);
    }
  }
  for (const el of $$<HTMLElement>('[data-ego-ch]', root)) {
    el.classList.toggle('ahead', p > 0 && +el.dataset.egoCh! > p);
  }
  for (const el of $$<HTMLElement>('[data-strip-ch]', root)) {
    const ch = +el.dataset.stripCh!;
    const ahead = p > 0 && ch > p;
    el.classList.toggle('ahead', ahead);
    const titleEl = el.querySelector('title');
    if (titleEl && el.dataset.fullTitle) {
      titleEl.textContent = ahead ? `第${cn(ch)}回　尚未读到这一回` : el.dataset.fullTitle;
    }
  }
  if (badge) { badge.hidden = !p; badge.textContent = p ? cn(p) : ''; }
}
export function setProgress(p: number) {
  const d = document.documentElement;
  if (p > 0 && p < 120) { d.dataset.progress = String(p); d.classList.add('guard'); store.set('hlm-progress', String(p)); }
  else { delete d.dataset.progress; d.classList.remove('guard'); store.set('hlm-progress', null); }
  $$('.spoil[data-opened]').forEach(el => { delete el.dataset.opened; });
  applyGuard();
  dispatchEvent(new CustomEvent('hlm:progress', { detail: progress() }));
}
const showOut = () => {
  if (!progOut || !progRange) return;
  progOut.textContent = +progRange.value >= 120 ? '全书' : `第${cn(+progRange.value)}回`;
  progRange.setAttribute('aria-valuetext', progOut.textContent);
};
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
const pal = $<HTMLDialogElement>('[data-palette]');
const palQ = $<HTMLInputElement>('[data-pal-q]');
const palList = $('[data-pal-list]');
const palText = $<HTMLAnchorElement>('[data-pal-text]');
let index: SearchIndex | null = null;
let sel = 0;
let items: HTMLAnchorElement[] = [];
const SEAL: Record<string, string> = { rong: '荣', ning: '宁', shi: '史', wang: '王', xue: '薛', lin: '林', oth: '亲', out: '外', myth: '幻' };
async function loadIndex() {
  if (index) return;
  const response = await fetch('/search.json');
  if (!response.ok) throw new Error('搜索目录未能加载');
  index = await response.json();
}
function render() {
  if (!palList || !index || !palQ) return;
  const raw = palQ.value.trim();
  const q = normSearch(raw), limit = progress();
  const out: string[] = [];
  let count = 0;
  const push = (html: string, href: string) => out.push(`<a class="pal-item" id="pal-result-${count++}" role="option" href="${esc(href)}">${html}</a>`);
  const section = (t: string) => out.push(`<div class="pal-sec" role="presentation">${t}</div>`);
  const rank: Record<string, number> = { c: 0, m: 1, o: 2, s: 3 };
  const people = (q ? index.p.map(p => {
    const names = p[4].split(' ').map(normSearch), id = normSearch(p[0]);
    const title = limit ? p[6] : p[3];
    const score = id === q ? 0 : names.includes(q) ? 1 : id.includes(q) ? 2 : names.some(n => n.includes(q)) ? 3 : normSearch(title).includes(q) ? 4 : 9;
    return { p, score };
  }).filter(x => x.score < 9).sort((a, b) => a.score - b.score || rank[a.p[2]] - rank[b.p[2]] || b.p[5] - a.p[5]) : index.p.filter(p => p[2] === 'c').map(p => ({ p, score: 0 })).sort((a, b) => b.p[5] - a.p[5])).slice(0, q ? 8 : 6);
  if (people.length) {
    section(q ? '人物' : '常看的人物');
    for (const { p } of people) {
      const alias = q && !normSearch(p[0]).includes(q) ? p[4].split(' ').find(a => normSearch(a).includes(q)) : '';
      push(`<span class="seal" style="--seal-bg:var(--g-${p[1]})">${SEAL[p[1]]}</span><span class="pal-main"><span class="pal-name">${highlight(p[0], raw)}</span><span class="pal-sub">${alias ? `也叫 ${highlight(alias, raw)} · ` : ''}${esc(limit ? p[6] : p[3])}</span></span>`, `/people/${encodeURIComponent(p[0])}/`);
    }
  }
  const hui = parseHui(q);
  const direct = hui ? [index.c[hui - 1]] : [];
  const matched = q ? index.c.filter(c => c[0] !== hui && (!limit || c[0] <= limit) && normSearch(c[2] + c[3]).includes(q)) : [];
  const chapters = [...direct, ...matched].slice(0, 6);
  if (chapters.length) {
    section('回目');
    for (const c of chapters) push(`<span class="pal-hui">${c[1]}</span><span class="pal-main"><span class="pal-name">${limit && c[0] > limit ? '尚未读到这一回' : `${highlight(c[2], raw)}　${highlight(c[3], raw)}`}</span></span>`, `/chapters/${c[0]}/?ref=search`);
  }
  if (q) {
    const events = index.e.filter(e => (!limit || e[2] <= limit) && normSearch(e[0] + e[3]).includes(q)).slice(0, 4);
    const places = index.g.filter(g => normSearch(g[1] + g[2]).includes(q)).slice(0, 3);
    if (events.length || places.length) section('大事与园中');
    for (const g of places) push(`<span class="seal outline">园</span><span class="pal-main"><span class="pal-name">${highlight(g[1], raw)}</span><span class="pal-sub">${esc(g[2])}</span></span>`, `/garden/#${g[0]}`);
    for (const e of events) push(`<span class="pal-hui">${e[1] === e[2] ? `第${cn(e[1])}回` : `第${cn(e[1])}至${cn(e[2])}回`}</span><span class="pal-main"><span class="pal-name">${highlight(e[0], raw)}</span></span>`, `/chapters/${e[1]}/?ref=search`);
  }
  if (!count) out.push(`<div class="pal-empty">${limit ? '已读范围内没有找到。' : '没有找到。'}试试人名、别称或回目。</div>`);
  palList.innerHTML = out.join('');
  items = $$<HTMLAnchorElement>('.pal-item', palList);
  items.forEach((el, i) => el.addEventListener('mousemove', () => select(i, false)));
  if (palText) {
    palText.hidden = raw.length < 2;
    palText.href = `/search/?q=${encodeURIComponent(raw)}`;
    palText.textContent = limit ? '在已读原文中查找' : '搜原文';
  }
  palQ.removeAttribute('aria-activedescendant');
  select(0);
}
function select(i: number, scroll = true) {
  if (!items.length) return;
  sel = (i + items.length) % items.length;
  items.forEach((el, k) => el.setAttribute('aria-selected', String(k === sel)));
  palQ?.setAttribute('aria-activedescendant', items[sel].id);
  if (scroll) items[sel].scrollIntoView({ block: 'nearest' });
}
async function openPalette(initial = '') {
  if (!pal || !palQ || !palList) return;
  if (!pal.open) pal.showModal();
  palQ.value = initial;
  palQ.focus();
  try {
    await loadIndex();
    render();
  } catch {
    palList.innerHTML = '<div class="pal-empty">搜索目录未能加载。<button type="button" data-pal-retry>重新加载</button></div>';
    $('[data-pal-retry]', palList)!.addEventListener('click', () => openPalette(palQ!.value));
  }
}
let timer = 0;
palQ?.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(render, 90); });
palQ?.addEventListener('keydown', e => {
  if (e.isComposing) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (items[sel]) location.href = items[sel].href;
    else if (palText && !palText.hidden) location.href = palText.href;
  }
});
pal?.addEventListener('click', e => { if (e.target === pal) pal.close(); });
$$('[data-search-open]').forEach(b => b.addEventListener('click', () => openPalette()));
addEventListener('hlm:progress', () => { if (pal?.open) render(); });
addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openPalette(); }
});
$$<HTMLFormElement>('[data-search-form]').forEach(f => f.addEventListener('submit', e => {
  e.preventDefault();
  openPalette((f.querySelector('input') as HTMLInputElement).value);
}));
/* ---------- 人物悬停卡 ---------- */
let peopleMap: Record<string, PersonCard> | null = null;
let peek: HTMLElement | null = null;
let peekTimer = 0;
let peekFor: Element | null = null;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
async function showPeek(a: HTMLAnchorElement) {
  /* SVG 里的链接没有 pathname，统一从 href 解析 */
  const href = a.getAttribute('href') ?? (a as unknown as SVGAElement).href?.baseVal ?? '';
  const id = decodeURIComponent(new URL(href, location.href).pathname.split('/')[2] || '');
  if (!id) return;
  if (!peopleMap) {
    const response = await fetch('/people.json');
    if (!response.ok) throw new Error('人物资料未能加载');
    peopleMap = await response.json();
  }
  const p = peopleMap![id];
  if (!p || peekFor !== a) return;
  peek ??= Object.assign(document.createElement('div'), { id: 'person-peek', className: 'peek', role: 'tooltip' });
  const info = progress() ? p.preview : p;
  peek.innerHTML = `<div class="peek-head">${p.portrait ? `<img class="peek-img" src="${esc(p.portrait)}" alt="" width="44" height="58">` : `<span class="seal" style="--s:40px;--seal-bg:var(--g-${p.group})">${SEAL[p.group]}</span>`}<div><div class="peek-name">${esc(id)}</div><div class="peek-title">${esc(info.title)}</div></div></div>${info.bio ? `<p class="peek-bio">${esc(info.bio)}</p>` : ''}<p class="peek-end"><b>归属</b>${esc(p.groupName)}</p>`;
  peek.hidden = false;
  a.setAttribute('aria-describedby', peek.id);
  document.body.append(peek);
  const r = a.getBoundingClientRect();
  const w = peek.offsetWidth, h = peek.offsetHeight;
  let x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12);
  let y = r.bottom + 10;
  if (y + h > innerHeight - 12) y = Math.max(12, r.top - h - 10);
  peek.style.left = x + 'px';
  peek.style.top = y + 'px';
  requestAnimationFrame(() => peek?.classList.add('show'));
}
function hidePeek() {
  clearTimeout(peekTimer);
  peekFor?.removeAttribute('aria-describedby');
  peekFor = null;
  peek?.classList.remove('show');
  if (peek) peek.hidden = true;
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
document.addEventListener('focusin', e => {
  const a = (e.target as Element).closest?.('a[data-peek]') as HTMLAnchorElement | null;
  if (!a) return;
  hidePeek();
  peekFor = a;
  showPeek(a);
});
document.addEventListener('focusout', hidePeek);
addEventListener('hlm:progress', hidePeek);

/* 窄屏上横着滚的图：年表类从右往左读，一打开先停在最右边；罗盘停在正中 */
for (const el of $$<HTMLElement>('[data-scroll-start]')) {
  const at = el.dataset.scrollStart;
  if (el.scrollWidth <= el.clientWidth) continue;
  el.scrollLeft = at === 'center' ? (el.scrollWidth - el.clientWidth) / 2 : el.scrollWidth;
}

export { $, $$, store, esc, cn };
