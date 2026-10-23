import { cn, progress } from './site.ts';
import { toSimplified, highlight, escapeHtml, parseHui } from '../lib/search.ts';

const form = document.querySelector<HTMLFormElement>('[data-text-search]')!;
const query = form.elements.namedItem('q') as HTMLInputElement;
const from = form.elements.namedItem('from') as HTMLSelectElement;
const to = form.elements.namedItem('to') as HTMLSelectElement;
const unread = form.elements.namedItem('unread') as HTMLInputElement;
const status = document.querySelector<HTMLElement>('[data-search-status]')!;
const results = document.querySelector<HTMLOListElement>('[data-text-results]')!;
const pages = document.querySelector<HTMLElement>('[data-result-pages]')!;
const previous = document.querySelector<HTMLButtonElement>('[data-result-prev]')!;
const next = document.querySelector<HTMLButtonElement>('[data-result-next]')!;
const pageLabel = document.querySelector<HTMLElement>('[data-result-page]')!;
const pageSize = 20;
let texts: string[] | null = null;
let normalized: string[] = [];
let loading: Promise<void> | null = null;
let hits: { n: number; at: number }[] = [];
let page = 0;
let term = '';
let revision = 0;

function showPage() {
  const fragment = hits.slice(page * pageSize, (page + 1) * pageSize).map(hit => {
    const text = texts![hit.n - 1];
    const start = Math.max(0, hit.at - 34), end = Math.min(text.length, hit.at + term.length + 64);
    const excerpt = `${start ? '…' : ''}${text.slice(start, end).replace(/\n/g, ' ')}${end < text.length ? '…' : ''}`;
    const href = `/chapters/${hit.n}/?q=${encodeURIComponent(term)}&hit=${hit.at}&ref=search`;
    return `<li><a href="${escapeHtml(href)}"><b>第${cn(hit.n)}回</b><p>${highlight(excerpt, term)}</p></a></li>`;
  });
  results.innerHTML = fragment.join('');
  const count = Math.ceil(hits.length / pageSize);
  pages.hidden = count <= 1;
  pageLabel.textContent = `第${cn(page + 1)}页，共${cn(count)}页`;
  previous.disabled = page === 0;
  next.disabled = page + 1 >= count;
}

async function loadText() {
  if (texts) return;
  if (!loading) loading = (async () => {
    const response = await fetch('/text.json');
    if (!response.ok) throw new Error('原文未能加载');
    texts = await response.json();
    normalized = texts!.map(toSimplified);
  })();
  try { await loading; } finally { loading = null; }
}

async function search(updateUrl = true) {
  const run = ++revision;
  term = query.value.trim();
  if (term.length < 2) {
    status.textContent = '请至少输入两个字。';
    results.replaceChildren(); pages.hidden = true; results.removeAttribute('aria-busy'); return;
  }
  const first = +from.value;
  const last = Math.min(+to.value, progress() && !unread.checked ? progress() : 120);
  if (first > last) {
    status.textContent = progress() && !unread.checked ? '起始回目超出已读范围，请调整回目或选择包含未读回目。' : '起始回目应在结束回目之前。';
    results.replaceChildren(); pages.hidden = true; results.removeAttribute('aria-busy'); return;
  }
  if (updateUrl) {
    const params = new URLSearchParams({ q: term, from: String(first), to: to.value });
    if (unread.checked) params.set('unread', '1');
    history.replaceState(null, '', `?${params}`);
  }
  status.textContent = '正在翻原书……';
  results.setAttribute('aria-busy', 'true');
  try {
    await loadText();
    if (run !== revision) return;
    const needle = toSimplified(term);
    hits = [];
    for (let n = first; n <= last; n++) {
      const text = normalized[n - 1];
      let at = text.indexOf(needle);
      while (at >= 0) { hits.push({ n, at }); at = text.indexOf(needle, at + needle.length); }
    }
    page = 0;
    status.textContent = hits.length ? `第${cn(first)}至${cn(last)}回，共${cn(hits.length)}处` : `第${cn(first)}至${cn(last)}回没有找到“${term}”。`;
    showPage();
  } catch {
    if (run !== revision) return;
    status.textContent = '原文未能加载，请再次点击查找。';
    results.replaceChildren(); pages.hidden = true;
  } finally {
    if (run === revision) results.removeAttribute('aria-busy');
  }
}

form.addEventListener('submit', e => { e.preventDefault(); search(); });
for (const [button, delta] of [[previous, -1], [next, 1]] as const) {
  button.addEventListener('click', () => {
    page += delta;
    showPage();
    status.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
}
function syncGuard() {
  document.querySelector<HTMLElement>('[data-unread-control]')!.hidden = !progress();
}
addEventListener('hlm:progress', () => { syncGuard(); if (term) search(); });
syncGuard();
const params = new URLSearchParams(location.search);
query.value = params.get('q') ?? '';
from.value = String(parseHui(params.get('from') ?? '') ?? 1);
to.value = String(parseHui(params.get('to') ?? '') ?? 120);
unread.checked = params.get('unread') === '1';
if (query.value.trim().length >= 2) search(false);
