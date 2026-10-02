/* ============ 核心工具 ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 存储不可用时忽略 */ } }
};

const PEOPLE = NODES.map(a => ({ id: a[0], grp: a[1], kind: a[2], tag: a[3], sub: a[4], bio: a[5], fate: a[6] }));
const byId = new Map(PEOPLE.map(n => [n.id, n]));
const REL = EDGES.map(a => ({ a: a[0], b: a[1], type: a[2], label: a[3], note: a[4] || '' }));
const adj = new Map(PEOPLE.map(n => [n.id, []]));
REL.forEach(e => { adj.get(e.a).push(e); adj.get(e.b).push(e); });
const TYPE_ORDER = ['b', 'm', 'in', 'sv', 'lv', 'fr', 'ri', 'my'];
const KIND_RANK = { c: 0, m: 1, o: 2, s: 3 };
const evOf = new Map(PEOPLE.map(n => [n.id, []]));
EVENTS.forEach((ev, i) => { ev.i = i; ev.n = ev.c[0]; ev.late = ev.n > 80; ev.ids.forEach(id => evOf.get(id).push(ev)); });

/* 从 selfId 看,对方是自己的什么人 */
function relFor(e, selfId) {
  const other = e.a === selfId ? e.b : e.a;
  let role = e.label;
  if (role.includes('/')) {
    const [p, q] = role.split('/');
    role = e.a === selfId ? q : p;
  }
  return { other, role, e };
}
const gColor = grp => `var(--g-${grp})`;
const tagName = t => TAGS[t] || '';
const verseOf = id => [...TWELVE, ...TWELVE_MORE].find(v => v.ids.includes(id));
const pill = id => `<button class="pill" type="button" style="--c:${gColor(byId.get(id).grp)}" data-pick="${esc(id)}">${esc(id)}</button>`;

/* 回目数字转汉字:27 → 二十七,105 → 一百零五 */
function cnNum(n) {
  const d = '零一二三四五六七八九';
  if (n < 10) return d[n];
  if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
  if (n < 100) return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '');
  const r = n - 100;
  return '一百' + (r === 0 ? '' : r < 10 ? '零' + d[r] : (r < 20 ? '一' : '') + cnNum(r));
}
const chName = c => c.length > 1 ? `第${cnNum(c[0])}至${cnNum(c[c.length - 1])}回` : `第${cnNum(c[0])}回`;
const chShort = c => c.length > 1 ? `${c[0]}–${c[c.length - 1]} 回` : `${c[0]} 回`;

/* ============ 主题 ============ */
const Theme = {
  cur() {
    return document.documentElement.getAttribute('data-theme')
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  },
  init() {
    const saved = store.get('hlm-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
    $('#themeBtn').addEventListener('click', () => {
      const next = this.cur() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set('hlm-theme', next);
      this.label();
    });
    this.label();
  },
  label() { $('#themeBtn').textContent = this.cur() === 'dark' ? '换素绢底' : '换漆夜底'; }
};

/* ============ 人物抽屉 ============ */
const Drawer = {
  el: null, cur: null, trail: [],
  init() {
    this.el = $('#drawer');
    this.el.addEventListener('click', ev => {
      const act = ev.target.closest('[data-act]');
      if (act) {
        const id = this.cur;
        if (act.dataset.act === 'close') Tabs.closeDrawerAndClear();
        if (act.dataset.act === 'locate') { Tabs.show('graph', true); Graph.select(id, true); }
        if (act.dataset.act === 'radial') { Tabs.show('graph', true); Graph.radial(id); }
        if (act.dataset.act === 'verse') { this.close(); Tabs.show('twelve', true); Twelve.focus(id); }
        return;
      }
      const evb = ev.target.closest('[data-ev]');
      if (evb) { this.close(); Tabs.show('timeline', true); Timeline.focus(+evb.dataset.ev); }
    });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && this.cur) Tabs.closeDrawerAndClear(); });
  },
  open(id) {
    const n = byId.get(id);
    if (!n) return;
    if (this.el.classList.contains('open') && this.cur && this.cur !== id) {
      const i = this.trail.indexOf(id);
      if (i >= 0) this.trail = this.trail.slice(0, i);
      else { this.trail = this.trail.filter(x => x !== this.cur); this.trail.push(this.cur); if (this.trail.length > 6) this.trail.shift(); }
    }
    this.cur = id;
    const rels = adj.get(id).map(e => relFor(e, id));
    const groups = {};
    rels.forEach(r => (groups[r.e.type] = groups[r.e.type] || []).push(r));
    const v = verseOf(id), evs = evOf.get(id);
    let h = `<button class="dclose" type="button" data-act="close" aria-label="关闭">×</button>`;
    if (this.trail.length) h += `<nav class="d-trail" aria-label="浏览足迹"><span>足迹</span>${this.trail.map(t => `<button type="button" data-pick="${esc(t)}">${esc(t)}</button><i>›</i>`).join('')}<b>${esc(id)}</b></nav>`;
    h += `<div class="d-name">${esc(n.id)}</div><div class="d-sub">${esc(n.sub)}</div>`;
    h += `<div class="d-tags"><span class="tag"><i class="dot" style="--c:${gColor(n.grp)}"></i>${GROUPS[n.grp].name}</span>`;
    if (n.tag) h += `<span class="tag red">${tagName(n.tag)}</span>`;
    if (n.kind === 'o') h += `<span class="tag">器物</span>`;
    h += `<span class="tag">${rels.length} 条关系</span>`;
    if (evs.length) h += `<span class="tag">${evs.length} 件大事</span>`;
    h += `</div><p class="d-bio">${esc(n.bio)}</p>`;
    if (n.fate) h += `<div class="d-fate"><b>结局</b>${esc(n.fate)}</div>`;
    if (v) h += `<div class="d-verse"><b>判词</b>${v.verse.map(esc).join(',')}</div>`;
    h += `<div class="d-actions"><button class="btn" type="button" data-act="radial">以此人为中心展开</button>`;
    if (Tabs.cur !== 'graph') h += `<button class="btn" type="button" data-act="locate">在星图中定位</button>`;
    if (v) h += `<button class="btn" type="button" data-act="verse">看判词</button>`;
    h += `</div>`;
    TYPE_ORDER.forEach(t => {
      const list = groups[t];
      if (!list) return;
      list.sort((x, y) => KIND_RANK[byId.get(x.other).kind] - KIND_RANK[byId.get(y.other).kind]);
      h += `<div class="d-sec" style="--c:var(--e-${t})">${TYPES[t].name} ${list.length}</div>`;
      list.forEach(r => {
        const o = byId.get(r.other);
        h += `<button class="rel" type="button" data-pick="${esc(o.id)}"><span class="role">${esc(r.role)}</span><span class="main"><span class="nm"><i class="dot" style="--c:${gColor(o.grp)}"></i>${esc(o.id)}</span>`;
        if (r.e.note) h += `<span class="note">${esc(r.e.note)}</span>`;
        h += `</span></button>`;
      });
    });
    if (evs.length) {
      h += `<div class="d-sec" style="--c:var(--gold2)">书中经历 ${evs.length}</div>`;
      h += evs.map(e => `<button class="rel" type="button" data-ev="${e.i}"><span class="role">${chShort(e.c)}</span><span class="main"><span class="nm">${esc(e.t)}</span>${e.late ? '<span class="note">续书</span>' : ''}</span></button>`).join('');
    }
    this.el.innerHTML = h;
    this.el.scrollTop = 0;
    this.el.classList.add('open');
  },
  close() { this.el.classList.remove('open'); this.cur = null; this.trail = []; }
};

/* 统一的"选中某人"入口:星图页联动高亮,其他页只开抽屉 */
function pickPerson(id) {
  if (!byId.has(id)) return;
  if (Tabs.cur === 'graph' && Tabs.inited.graph) Graph.select(id, true);
  else Drawer.open(id);
}

/* ============ 联想搜索 ============ */
function bindSearch(input, listEl, onPick) {
  let items = [], hi = -1;
  const hide = () => { listEl.hidden = true; hi = -1; };
  const render = q => {
    q = q.trim();
    if (!q) { hide(); return; }
    items = PEOPLE.filter(n => n.id.includes(q) || n.sub.includes(q))
      .sort((a, b) => (a.id.startsWith(q) ? 0 : 1) - (b.id.startsWith(q) ? 0 : 1) || KIND_RANK[a.kind] - KIND_RANK[b.kind]).slice(0, 12);
    if (!items.length) { listEl.innerHTML = '<button type="button" disabled>没有找到这个人物</button>'; listEl.hidden = false; return; }
    listEl.innerHTML = items.map((n, i) => `<button type="button" data-i="${i}"><i class="dot" style="--c:${gColor(n.grp)}"></i>${esc(n.id)}<small>${esc(n.sub.split(' · ')[0])}</small></button>`).join('');
    listEl.hidden = false; hi = -1;
  };
  const pick = i => { const n = items[i]; if (!n) return; input.value = n.id; hide(); onPick(n.id); };
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => render(input.value));
  input.addEventListener('keydown', ev => {
    if (listEl.hidden) return;
    const bs = $$('button[data-i]', listEl);
    if (ev.key === 'ArrowDown') { hi = Math.min(hi + 1, bs.length - 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { hi = Math.max(hi - 1, 0); ev.preventDefault(); }
    else if (ev.key === 'Enter') { pick(hi >= 0 ? hi : 0); ev.preventDefault(); return; }
    else if (ev.key === 'Escape') { hide(); return; }
    bs.forEach((b, i) => b.classList.toggle('hi', i === hi));
  });
  listEl.addEventListener('mousedown', ev => { const b = ev.target.closest('button[data-i]'); if (b) { ev.preventDefault(); pick(+b.dataset.i); } });
  input.addEventListener('blur', () => setTimeout(hide, 120));
}

/* ============ 标签页 ============ */
const Tabs = {
  cur: null, inited: {},
  names: ['graph', 'tree', 'families', 'twelve', 'garden', 'timeline', 'love', 'index'],
  init() {
    const bar = $('.tabs-in');
    $$('.tab').forEach(b => b.addEventListener('click', () => this.show(b.dataset.tab, true)));
    bar.addEventListener('keydown', ev => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      const tabs = $$('.tab'), i = tabs.findIndex(t => t.dataset.tab === this.cur);
      const next = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      this.show(next.dataset.tab, true); next.focus(); ev.preventDefault();
    });
    const h = location.hash.replace('#', '');
    this.show(this.names.includes(h) ? h : 'graph');
  },
  show(name, userClick) {
    if (!this.names.includes(name)) return;
    const changed = this.cur !== name;
    this.cur = name;
    $$('.tab').forEach(b => { const on = b.dataset.tab === name; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $$('.sec').forEach(s => { s.hidden = s.id !== 'tab-' + name; });
    if (!this.inited[name]) {
      this.inited[name] = true;
      ({ graph: Graph, tree: Tree, families: Families, twelve: Twelve, garden: Garden, timeline: Timeline, love: Love, index: PeopleIndex })[name].init();
    } else if (name === 'graph') Graph.resize();
    if (changed) Drawer.close();
    if (userClick) {
      try { history.replaceState(null, '', '#' + name); } catch (e) { /* 沙箱里改不了地址时忽略 */ }
      const top = $('.tabs').offsetTop;
      if (window.scrollY > top) window.scrollTo({ top, behavior: 'auto' });
    }
  },
  closeDrawerAndClear() {
    Drawer.close();
    if (this.cur === 'graph' && this.inited.graph) Graph.clearSelection();
  }
};
