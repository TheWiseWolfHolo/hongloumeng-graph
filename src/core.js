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

/* 从 selfId 看，对方是自己的什么人 */
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

/* 回目数字转汉字：27 → 二十七，105 → 一百零五 */
function cnNum(n) {
  const d = '零一二三四五六七八九';
  if (n < 10) return d[n];
  if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
  if (n < 100) return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '');
  const r = n - 100;
  return '一百' + (r === 0 ? '' : r < 10 ? '零' + d[r] : (r < 20 ? '一' : '') + cnNum(r));
}
/* 正册十二钗的画像：AI 生成的工笔设色，衣饰与场景依书中描写补足，不作考证 */
const PORTRAITS = {
  林黛玉: 'daiyu', 薛宝钗: 'baochai', 贾元春: 'yuanchun', 贾探春: 'tanchun', 史湘云: 'xiangyun', 妙玉: 'miaoyu',
  贾迎春: 'yingchun', 贾惜春: 'xichun', 王熙凤: 'xifeng', 巧姐: 'qiaojie', 李纨: 'liwan', 秦可卿: 'keqing'
};
const portrait = id => PORTRAITS[id] ? `img/12/${PORTRAITS[id]}.webp` : '';
/* 看大图：点画像铺满屏幕，再点一下或按 Esc 收起 */
const Zoom = {
  open(src, label) {
    const o = document.createElement('div');
    o.className = 'zoom';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-label', label);
    o.innerHTML = `<img src="${src}" alt="${esc(label)}">`;
    const key = ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); } };
    const close = () => { o.remove(); document.removeEventListener('keydown', key, true); };
    o.addEventListener('click', close);
    document.addEventListener('keydown', key, true);
    document.body.appendChild(o);
  }
};
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
  label() {
    const dark = this.cur() === 'dark', b = $('#themeBtn');
    b.textContent = dark ? '昼' : '夜';
    b.title = dark ? '换宣纸底' : '换磁青夜底';
    b.setAttribute('aria-label', b.title);
  }
};

/* ============ 人物抽屉 ============
   宽屏是右侧的抽屉；手机上是从底部拉起的卡片，有露头、半屏、全屏三档，按住上方的把手或名字区上下拖。 */
const Drawer = {
  el: null, head: null, body: null, cur: null, trail: [], snap: 'closed', dragged: false,
  sheet: matchMedia('(max-width: 640px)'),
  init() {
    this.el = $('#drawer');
    this.el.innerHTML = '<div class="d-grip" aria-hidden="true"><i></i></div><div class="d-head"></div><div class="d-body"></div>';
    this.head = $('.d-head', this.el);
    this.body = $('.d-body', this.el);
    this.el.addEventListener('click', ev => {
      /* 刚拖完卡片，松手时落在按钮上的那一下不算点击 */
      if (this.dragged) { this.dragged = false; ev.stopPropagation(); ev.preventDefault(); return; }
      const act = ev.target.closest('[data-act]');
      if (act) {
        const id = this.cur;
        if (act.dataset.act === 'close') Tabs.closeDrawerAndClear();
        if (act.dataset.act === 'locate') { Tabs.show('graph', true); Graph.focus(id, 'locate'); }
        if (act.dataset.act === 'radial') { Tabs.show('graph', true); Graph.focus(id, 'ego'); }
        if (act.dataset.act === 'chain') Graph.openPath(id);
        if (act.dataset.act === 'home') Graph.home();
        if (act.dataset.act === 'verse') { this.close(); Tabs.show('twelve', true); Twelve.focus(id); }
        return;
      }
      const evb = ev.target.closest('[data-ev]');
      if (evb) { this.close(); Tabs.show('timeline', true); Timeline.focus(+evb.dataset.ev); }
    });
    $('.d-grip', this.el).addEventListener('click', () => this.setSnap(this.snap === 'full' ? 'peek' : 'full'));
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && this.cur) { ev.preventDefault(); Tabs.closeDrawerAndClear(); } });
    this.bindSheet();
    this.sheet.addEventListener('change', () => this.place());
    addEventListener('resize', () => this.place());
  },
  /* 卡片往下推多少像素：0 是全屏，越大露出越少 */
  snapY(s) {
    const H = this.el.offsetHeight;
    if (s === 'full') return 0;
    if (s === 'half') return Math.max(0, H - Math.round(innerHeight * .56));
    if (s === 'peek') return Math.max(0, H - $('.d-grip', this.el).offsetHeight - this.head.offsetHeight);
    return H + 30;
  },
  setSnap(s) { this.snap = s; this.place(); },
  place() {
    const root = document.documentElement.style;
    root.setProperty('--sheet-cover', this.sheet.matches && this.cur && this.snap === 'peek' ? this.coverBottom() + 'px' : '0px');
    if (!this.sheet.matches) { this.el.style.removeProperty('--sy'); return; }
    if (this.snap === 'closed' && !this.el.classList.contains('open')) { this.el.style.removeProperty('--sy'); return; }
    this.el.style.setProperty('--sy', this.snapY(this.snap) + 'px');
  },
  /* 星图摆放时要让开的部分：手机上是底部被卡片盖住的高度，宽屏是右侧抽屉的宽度 */
  coverBottom() { return this.sheet.matches && this.cur ? Math.max(0, this.el.offsetHeight - this.snapY(this.snap)) : 0; },
  coverRight() { return !this.sheet.matches && this.cur ? this.el.offsetWidth : 0; },
  bindSheet() {
    let st = null;
    this.el.addEventListener('pointerdown', ev => {
      if (!this.sheet.matches || ev.button > 0 || !ev.target.closest('.d-grip, .d-head')) return;
      st = { id: ev.pointerId, y0: ev.clientY, s0: this.snapY(this.snap), moved: false, hist: [{ y: ev.clientY, t: performance.now() }] };
    });
    this.el.addEventListener('pointermove', ev => {
      if (!st || ev.pointerId !== st.id) return;
      const dy = ev.clientY - st.y0;
      if (!st.moved) {
        if (Math.abs(dy) < 7) return;
        st.moved = true;
        this.el.classList.add('drag');
        try { this.el.setPointerCapture(ev.pointerId); } catch (e) { /* 合成事件无法捕获指针 */ }
      }
      this.el.style.setProperty('--sy', Math.max(0, st.s0 + dy) + 'px');
      st.hist.push({ y: ev.clientY, t: performance.now() });
      if (st.hist.length > 6) st.hist.shift();
    });
    const end = ev => {
      if (!st || ev.pointerId !== st.id) return;
      const s = st; st = null;
      if (!s.moved) return;
      this.dragged = true;
      setTimeout(() => { this.dragged = false; }, 60);
      this.el.classList.remove('drag');
      const a = s.hist[0], b = s.hist[s.hist.length - 1];
      const v = (b.y - a.y) / Math.max(1, b.t - a.t);
      const proj = s.s0 + (ev.clientY - s.y0) + v * 200;
      let best = 'peek', bd = Infinity;
      ['full', 'half', 'peek', 'closed'].forEach(k => { const d = Math.abs(this.snapY(k) - proj); if (d < bd) { bd = d; best = k; } });
      if (best === 'closed') Tabs.closeDrawerAndClear(); else this.setSnap(best);
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  },
  open(id, opt = {}) {
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
    let hd = `<button class="dclose" type="button" data-act="close" aria-label="关闭"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    if (this.trail.length) hd += `<nav class="d-trail" aria-label="浏览足迹"><span>足迹</span>${this.trail.map(t => `<button type="button" data-pick="${esc(t)}">${esc(t)}</button><i>›</i>`).join('')}<b>${esc(id)}</b></nav>`;
    hd += `<div class="d-id"><div class="d-name">${esc(n.id)}</div><div class="d-sub">${esc(n.sub)}</div></div>`;
    hd += `<div class="d-actions">`;
    hd += opt.ego ? `<button class="btn" type="button" data-act="home">回到全景</button>` : `<button class="btn primary" type="button" data-act="radial">看命盘</button>`;
    hd += Tabs.cur === 'graph' ? `<button class="btn" type="button" data-act="chain">查关系链</button>` : `<button class="btn" type="button" data-act="locate">在星图中看</button>`;
    if (v) hd += `<button class="btn" type="button" data-act="verse">判词</button>`;
    hd += `</div>`;
    let h = `<div class="d-tags"><span class="tag"><i class="dot" style="--c:${gColor(n.grp)}"></i>${GROUPS[n.grp].name}</span>`;
    if (n.tag) h += `<span class="tag red">${tagName(n.tag)}</span>`;
    if (n.kind === 'o') h += `<span class="tag">器物</span>`;
    h += `<span class="tag">${rels.length} 条关系</span>`;
    if (evs.length) h += `<span class="tag">${evs.length} 件大事</span>`;
    h += `</div>`;
    if (PORTRAITS[id]) h += `<button class="d-pic" type="button" data-zoom="${portrait(id)}" aria-label="${esc(id)}画像"><img src="${portrait(id)}" alt="" loading="lazy" decoding="async" width="640" height="960"></button>`;
    h += `<p class="d-bio">${esc(n.bio)}</p>`;
    if (n.fate) h += `<div class="d-fate"><b>结局</b>${esc(n.fate)}</div>`;
    /* 判词两句一行，像诗那样断开 */
    if (v) h += `<div class="d-verse"><b>判词</b>${v.verse.map((l, i) => esc(l) + (i % 2 || i === v.verse.length - 1 ? '。' : '，')).map((l, i) => i % 2 ? l + '<br>' : l).join('').replace(/<br>$/, '')}</div>`;
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
    this.head.innerHTML = hd;
    this.body.innerHTML = h;
    this.body.scrollTop = 0;
    this.el.classList.add('open');
    if (this.sheet.matches) {
      /* 已经拉高的卡片保持高度；收着或露头时按调用方的意思来 */
      const keep = this.snap === 'full' || (this.snap === 'half' && !opt.snap);
      this.setSnap(keep ? this.snap : (opt.snap || 'half'));
    }
  },
  close() {
    this.el.classList.remove('open');
    this.cur = null; this.trail = [];
    this.setSnap('closed');
  }
};

/* 统一的“选中某人”入口：星图页联动高亮，其他页只开抽屉 */
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
    else if (ev.key === 'Escape') { hide(); ev.preventDefault(); return; }
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
    if (changed) { Drawer.close(); if (this.inited.graph && name !== 'graph') Graph.exitFull(); }
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
