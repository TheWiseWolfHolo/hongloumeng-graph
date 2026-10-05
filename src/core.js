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

const PEOPLE = Catalog.people;
const byId = new Map(PEOPLE.map(n => [n.id, n]));
const REL = Catalog.relations;
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
/* 册页人物画像，作为阅读配图，不作服饰与场景考证。 */
const PORTRAITS = {
  林黛玉: 'daiyu.webp', 薛宝钗: 'baochai.webp', 贾元春: 'yuanchun.webp', 贾探春: 'tanchun.webp', 史湘云: 'xiangyun.webp', 妙玉: 'miaoyu.webp',
  贾迎春: 'yingchun.webp', 贾惜春: 'xichun.webp', 王熙凤: 'xifeng.webp', 巧姐: 'qiaojie.webp', 李纨: 'liwan.webp', 秦可卿: 'keqing.webp',
  香菱: 'xiangling.png', 晴雯: 'qingwen.png', 袭人: 'xiren.png'
};
const portrait = id => PORTRAITS[id] ? `img/12/${PORTRAITS[id]}` : '';
/* 看大图：点画像铺满屏幕，再点一下或按 Esc 收起 */
const Zoom = {
  open(src, label) {
    const trigger = document.activeElement;
    const o = document.createElement('dialog');
    o.className = 'zoom';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-label', label);
    o.innerHTML = `<button class="zoom-close" type="button" aria-label="关闭画像">关闭</button><img src="${src}" alt="${esc(label)}">`;
    const close = () => o.close();
    o.addEventListener('click', close);
    o.addEventListener('close', () => { o.remove(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); });
    o.addEventListener('cancel', ev => ev.stopPropagation());
    document.body.appendChild(o);
    o.showModal();
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
    this.el.inert = true;
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
        if (act.dataset.act === 'share') Reading.share(id, act);
        if (act.dataset.act === 'events') { Tabs.show('timeline', true); Timeline.setPerson(id); }
        return;
      }
      const jump = ev.target.closest('[data-profile-target]');
      if (jump) { const target = $('#' + jump.dataset.profileTarget, this.body); if (target) { target.scrollIntoView({ block: 'start', behavior: 'smooth' }); target.focus({ preventScroll: true }); } return; }
      const evb = ev.target.closest('[data-ev]');
      if (evb) { this.close(); Tabs.show('timeline', true); Timeline.focus(+evb.dataset.ev); }
    });
    $('.d-grip', this.el).addEventListener('click', () => this.setSnap(this.snap === 'full' ? 'peek' : 'full'));
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !ev.defaultPrevented && this.cur) { ev.preventDefault(); Tabs.closeDrawerAndClear(); } });
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
    const wasOpen = !!this.cur;
    if (!wasOpen) this.trigger = document.activeElement;
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
    hd += `<div class="d-id"><h2 class="d-name" tabindex="-1">${esc(n.id)}</h2><div class="d-sub">${esc(n.sub)}</div></div>`;
    hd += `<div class="d-actions">`;
    hd += opt.ego ? `<button class="btn" type="button" data-act="home">回到全景</button>` : `<button class="btn primary" type="button" data-act="radial">看人物关系</button>`;
    hd += Tabs.cur === 'graph' ? `<button class="btn" type="button" data-act="chain">查关系链</button>` : `<button class="btn" type="button" data-act="locate">在星图中看</button>`;
    if (v) hd += `<button class="btn" type="button" data-act="verse">判词</button>`;
    hd += `<button class="btn" type="button" data-act="share">复制链接</button>`;
    hd += `</div>`;
    let h = `<div class="d-tags"><span class="tag"><i class="dot" style="--c:${gColor(n.grp)}"></i>${GROUPS[n.grp].name}</span>`;
    if (n.tag) h += `<span class="tag red">${tagName(n.tag)}</span>`;
    if (n.kind === 'o') h += `<span class="tag">器物</span>`;
    h += `<span class="tag">${rels.length} 条关系</span>`;
    if (evs.length) h += `<span class="tag">${evs.length} 件大事</span>`;
    h += `</div>`;
    if (PORTRAITS[id]) h += `<button class="d-pic" type="button" data-zoom="${portrait(id)}" aria-label="${esc(id)}画像"><img src="${portrait(id)}" alt="" loading="lazy" decoding="async" width="640" height="960"></button>`;
    h += `<p class="d-bio">${esc(n.bio)}</p>`;
    if (n.aliases.length) h += `<p class="d-alias"><b>也叫</b>${n.aliases.map(esc).join('、')}</p>`;
    const places = GARDEN.filter(p => p.kind === 'home' && p.who?.includes(id));
    if (places.length) h += `<div class="d-homes"><span>园中住处</span>${places.map(p => `<button class="text-link" type="button" data-place="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
    h += `<nav class="profile-jumps" aria-label="人物详情目录"><button type="button" data-profile-target="profileRelations">亲友关系</button>${evs.length ? '<button type="button" data-profile-target="profileEvents">书中经历</button>' : ''}</nav>`;
    /* 判词两句一行，像诗那样断开 */
    h += '<div id="profileRelations" tabindex="-1">';
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
    h += '</div>';
    if (evs.length) {
      h += `<div class="d-sec" id="profileEvents" tabindex="-1" style="--c:var(--gold2)">书中经历 ${evs.length}<button class="text-link" type="button" data-act="events">在回目中读</button></div>`;
      h += evs.map(e => `<button class="rel" type="button" data-ev="${e.i}"><span class="role">${chShort(e.c)}</span><span class="main"><span class="nm">${esc(e.t)}</span>${e.late ? '<span class="note">续书</span>' : ''}</span></button>`).join('');
    }
    if (v) h += `<div class="d-verse"><b>第五回 · 判词</b>${v.verse.map((l, i) => esc(l) + (i % 2 || i === v.verse.length - 1 ? '。' : '，')).map((l, i) => i % 2 ? l + '<br>' : l).join('').replace(/<br>$/, '')}</div>`;
    if (n.fate) h += Reading.spoiler(`<p>${esc(n.fate)}</p><p class="source-note">标“续书”的情节取自后四十回；标“批语”的内容属于推断。其余为人物资料整理，具体版本与出处仍需逐条核对。</p>`);
    this.head.innerHTML = hd;
    this.body.innerHTML = h;
    this.body.scrollTop = 0;
    this.el.classList.add('open');
    this.el.inert = false;
    this.el.removeAttribute('aria-hidden');
    if (this.sheet.matches) {
      /* 已经拉高的卡片保持高度；收着或露头时按调用方的意思来 */
      const keep = this.snap === 'full' || (this.snap === 'half' && !opt.snap);
      this.setSnap(keep ? this.snap : (opt.snap || (Tabs.cur === 'graph' ? 'half' : 'full')));
    }
    $('.d-name', this.head).focus({ preventScroll: true });
    Reading.remember(id);
    Route.write(id);
  },
  close(silent = false) {
    const hadPerson = !!this.cur;
    const restore = this.el.contains(document.activeElement);
    this.el.classList.remove('open');
    this.el.inert = true;
    this.el.setAttribute('aria-hidden', 'true');
    this.cur = null; this.trail = [];
    this.setSnap('closed');
    if (!silent && hadPerson) {
      Route.write(null, true);
      if (restore) {
        const target = this.trigger?.isConnected && this.trigger.matches('button, input, a[href], [tabindex]') && !this.trigger.closest('[hidden], [inert]') ? this.trigger : $('.primary-tab[aria-selected="true"]');
        target?.focus({ preventScroll: true });
      }
    }
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
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listEl.id);
  input.setAttribute('aria-expanded', 'false');
  listEl.setAttribute('role', 'listbox');
  listEl.setAttribute('aria-label', '人物搜索结果');
  const hide = () => { listEl.hidden = true; hi = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
  const render = q => {
    q = q.trim();
    if (!q) { hide(); return; }
    items = Catalog.search(q, 12);
    input.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
    if (!items.length) { listEl.innerHTML = '<div class="search-empty" role="option" aria-disabled="true">没找到，试试姓名中的一两个字。</div>'; listEl.hidden = false; return; }
    listEl.innerHTML = items.map((n, i) => `<button type="button" role="option" tabindex="-1" aria-selected="false" id="${listEl.id}-${i}" data-i="${i}"><i class="dot" style="--c:${gColor(n.grp)}"></i>${esc(n.id)}<small>${esc(n.sub.split(' · ')[0])}</small></button>`).join('');
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
    else if (ev.key === 'Enter' && items.length) { pick(hi >= 0 ? hi : 0); ev.preventDefault(); return; }
    else if (ev.key === 'Escape') { hide(); ev.preventDefault(); return; }
    bs.forEach((b, i) => { b.classList.toggle('hi', i === hi); b.setAttribute('aria-selected', String(i === hi)); });
    if (hi >= 0) input.setAttribute('aria-activedescendant', `${listEl.id}-${hi}`);
  });
  listEl.addEventListener('pointerdown', ev => { if (ev.target.closest('button[data-i]')) ev.preventDefault(); });
  listEl.addEventListener('click', ev => { const b = ev.target.closest('button[data-i]'); if (b) pick(+b.dataset.i); });
  input.addEventListener('blur', () => setTimeout(hide, 120));
}

/* ============ 标签页 ============ */
const Tabs = {
  cur: null, inited: {},
  names: ['home', 'graph', 'tree', 'families', 'twelve', 'garden', 'timeline', 'love', 'index'],
  group(name) { return ['index', 'twelve'].includes(name) ? 'people' : ['graph', 'tree', 'families', 'love'].includes(name) ? 'relations' : name; },
  init() {
    $$('.tab').forEach((b, i) => { b.id = 'nav-' + i; b.setAttribute('aria-controls', 'tab-' + b.dataset.tab); b.addEventListener('click', () => this.show(b.dataset.tab, true)); });
    $$('[role="tablist"]').forEach(bar => bar.addEventListener('keydown', ev => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      const tabs = $$('.tab', bar), i = tabs.indexOf(document.activeElement);
      const next = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      this.show(next.dataset.tab, true); next.focus(); ev.preventDefault();
    }));
    Route.init();
  },
  show(name, userClick) {
    if (!this.names.includes(name)) return;
    const changed = this.cur !== name;
    if (changed) { Drawer.close(true); if (this.inited.graph && name !== 'graph') Graph.exitFull(true); }
    this.cur = name;
    $$('.tab').forEach(b => { const on = b.classList.contains('primary-tab') ? this.group(b.dataset.tab) === this.group(name) : b.dataset.tab === name; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $$('.subnav').forEach(el => { el.hidden = el.dataset.section !== this.group(name); });
    $$('.sec').forEach(s => { s.hidden = s.id !== 'tab-' + name; });
    const selected = $$('.tab[aria-selected="true"]').find(b => !b.classList.contains('primary-tab')) || $('.primary-tab[aria-selected="true"]');
    const panel = $('#tab-' + name);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', selected.id);
    if (!this.inited[name]) {
      this.inited[name] = true;
      ({ home: Home, graph: Graph, tree: Tree, families: Families, twelve: Twelve, garden: Garden, timeline: Timeline, love: Love, index: PeopleIndex })[name].init();
    } else if (name === 'graph') Graph.resize();
    document.title = (name === 'home' ? '红楼梦' : $('#tab-' + name + ' h2')?.textContent || '红楼梦') + ' · 人物关系图谱';
    if (userClick) {
      Drawer.close(true);
      Route.write(null);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  },
  closeDrawerAndClear() {
    Drawer.close();
    if (this.cur === 'graph' && this.inited.graph) Graph.clearSelection();
  }
};
