/* ============ 关系星图 ============
   全景是力导向布局,每个家族有自己的锚点和一团底色。名字按空隙自动显示,挤不下的先藏起来,放大后会陆续出现。
   双击某人进入"命盘":关系按类型分扇区,一人一个方位,连线都是从中心发出的直线,彼此不会压住。
   关系速查会把两人之间的关系链拉成一条横线。 */
const Graph = (() => {
  const svg = $('#gsvg');
  const stage = $('.stage');
  const tip = $('#gTip');
  const ALL_GROUPS = Object.keys(GROUPS);
  let W = 900, H = 600;
  let T = { x: 0, y: 0, k: 1 }, inv = 1;
  let root, gNeb, gGuide, gE, gN, gEgo;
  let nodes = [], links = [];
  const nmap = new Map(), lmap = new Map(), nebs = {};
  let alpha = 0, raf = 0, ready = false;
  const state = { types: new Set(TYPE_ORDER), groups: new Set(ALL_GROUPS), servants: true, focus: null, layout: 'family', preset: 'all' };
  let selected = null, hover = null, pathInfo = null;
  /* mode: all 全景 · ego 命盘 · chain 关系链 */
  let mode = 'all', egoId = null, egoInfo = null, egoTrail = [], egoChords = false;

  const RAD = { c: 17, m: 11.5, s: 7.2, o: 10.5 };
  const FS = { c: 15.5, m: 13, s: 11, o: 12 };
  const LEN = { m: 70, b: 96, in: 112, sv: 62, lv: 100, fr: 130, ri: 116, my: 96 };
  const STR = { m: .06, b: .045, in: .02, sv: .07, lv: .03, fr: .007, ri: .01, my: .03 };
  const WID = { m: 2.4, b: 1.8, in: 1.2, sv: 1.1, lv: 2.1, fr: 1.3, ri: 1.8, my: 1.8 };
  const COST = { b: 1, m: 1, in: 1.2, sv: 1.3, lv: 1.4, fr: 1.6, ri: 2, my: 2.2 };
  const SHORT = { b: '血亲', m: '婚配', in: '姻亲', sv: '主仆', lv: '情缘', fr: '交游', ri: '恩怨', my: '神缘' };
  const BEND = .1;
  const ANCH = {
    rong: [0, 20], ning: [620, -150], shi: [-620, -300], wang: [-480, 380], xue: [420, 430],
    lin: [-720, 60], oth: [760, 240], out: [80, -600], myth: [-400, -620]
  };
  const f1 = v => v.toFixed(1);

  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  /* ---------- 力导向 ---------- */
  function step() {
    const vis = nodes.filter(n => n.vis);
    const a = alpha;
    const kc = state.layout === 'family' ? .034 : .004;
    for (let i = 0; i < vis.length; i++) {
      const p = vis[i];
      for (let j = i + 1; j < vis.length; j++) {
        const q = vis[j];
        let dx = q.x - p.x, dy = q.y - p.y;
        let d2 = dx * dx + dy * dy;
        if (d2 > 360000) continue;
        if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
        const d = Math.sqrt(d2), ady = Math.abs(dy);
        /* 两个名字左右挨着、上下又几乎同高时,往上下错开一点 */
        if (Math.abs(dx) < (p.lw + q.lw) * .62 && ady < 24) {
          const push = (24 - ady) * .07, sy = dy >= 0 ? 1 : -1;
          p.vy -= sy * push; q.vy += sy * push;
        }
        const f = (9000 + (p.r + q.r) * 260) * a / d2;
        dx /= d; dy /= d;
        p.vx -= dx * f; p.vy -= dy * f; q.vx += dx * f; q.vy += dy * f;
        const min = p.r + q.r + (p.p.kind === 's' && q.p.kind === 's' ? 20 : 34);
        if (d < min) { const push = (min - d) * .4; p.vx -= dx * push; p.vy -= dy * push; q.vx += dx * push; q.vy += dy * push; }
      }
    }
    for (const l of links) {
      if (!l.vis) continue;
      const p = l.s, q = l.t;
      const dx = q.x - p.x, dy = q.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - l.len) * l.str * a / d;
      p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f;
    }
    for (const n of vis) {
      if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = n.vy = 0; continue; }
      const an = ANCH[n.p.grp], kk = n.p.grp === 'rong' ? kc * .3 : kc;
      n.vx += (an[0] - n.x) * kk * a; n.vy += (an[1] - n.y) * kk * a;
      n.vx -= n.x * .0008 * a; n.vy -= n.y * .0008 * a;
      n.vx *= .76; n.vy *= .76;
      n.x += Math.max(-40, Math.min(40, n.vx)); n.y += Math.max(-40, Math.min(40, n.vy));
    }
    alpha *= .992;
  }
  function paint() {
    for (const n of nodes) if (n.vis) n.el.setAttribute('transform', `translate(${f1(n.x)} ${f1(n.y)})`);
    const ego = mode === 'ego' ? nmap.get(egoId) : null;
    for (const l of links) {
      if (!l.vis) continue;
      const x1 = l.s.x, y1 = l.s.y, x2 = l.t.x, y2 = l.t.y, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      let cx, cy;
      if (mode === 'chain' || (ego && (l.s === ego || l.t === ego))) { cx = mx; cy = my; }
      else if (ego) { cx = ego.x + (mx - ego.x) * .3; cy = ego.y + (my - ego.y) * .3; }
      else { cx = mx - (y2 - y1) * BEND; cy = my + (x2 - x1) * BEND; }
      const d = `M${f1(x1)} ${f1(y1)}Q${f1(cx)} ${f1(cy)} ${f1(x2)} ${f1(y2)}`;
      l.line.setAttribute('d', d);
      l.hit.setAttribute('d', d);
      l.lab.setAttribute('x', f1((x1 + 2 * cx + x2) / 4));
      l.lab.setAttribute('y', f1((y1 + 2 * cy + y2) / 4 - 4));
    }
    if (mode === 'all') paintNebulae();
    scheduleLabels();
  }
  function loop() {
    raf = 0;
    if (alpha < .004) return;
    step(); step(); paint();
    raf = requestAnimationFrame(loop);
  }
  function reheat(a) {
    alpha = Math.max(alpha, a == null ? .5 : a);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  /* ---------- 家族星云:每家一团淡淡的底色,上面写家名 ---------- */
  function paintNebulae() {
    const acc = {};
    for (const n of nodes) {
      if (!n.vis) continue;
      const a = acc[n.p.grp] || (acc[n.p.grp] = { x: 0, y: 0, list: [] });
      a.x += n.x; a.y += n.y; a.list.push(n);
    }
    ALL_GROUPS.forEach(g => {
      const nb = nebs[g], a = acc[g];
      if (!a || a.list.length < 3) { nb.g.style.display = 'none'; return; }
      const cx = a.x / a.list.length, cy = a.y / a.list.length;
      let s = 0;
      a.list.forEach(n => { s += (n.x - cx) ** 2 + (n.y - cy) ** 2; });
      const sp = Math.sqrt(s / a.list.length);
      nb.g.style.display = '';
      nb.c.setAttribute('cx', f1(cx)); nb.c.setAttribute('cy', f1(cy)); nb.c.setAttribute('r', f1(sp * 1.45 + 70));
      nb.t.setAttribute('x', f1(cx)); nb.t.setAttribute('y', f1(cy - sp * 1.05 - 26));
    });
  }

  /* ---------- 名字摆放:按重要程度依次找空位,下、上、右、左都放不下就先藏起来 ---------- */
  let labRaf = 0;
  const scheduleLabels = () => { if (!labRaf) labRaf = requestAnimationFrame(placeLabels); };
  const pri = n => (n.id === selected ? 1e4 : 0) + (n.lit ? 1e3 : 0) + (3 - KIND_RANK[n.p.kind]) * 40 + Math.min(adj.get(n.id).length, 30);
  function setLab(n, pos, g, h) {
    n.el.classList.toggle('nolab', !pos);
    if (!pos) return;
    const t = n.labEl;
    if (pos === 'b') { t.setAttribute('x', 0); t.setAttribute('y', f1(g)); t.style.textAnchor = 'middle'; }
    else if (pos === 't') { t.setAttribute('x', 0); t.setAttribute('y', f1(-g - h)); t.style.textAnchor = 'middle'; }
    else if (pos === 'r') { t.setAttribute('x', f1(g + 1)); t.setAttribute('y', f1(-h / 2)); t.style.textAnchor = 'start'; }
    else { t.setAttribute('x', f1(-g - 1)); t.setAttribute('y', f1(-h / 2)); t.style.textAnchor = 'end'; }
  }
  function placeLabels() {
    labRaf = 0;
    const vis = nodes.filter(n => n.vis);
    if (mode === 'ego') { vis.forEach(n => n.el.classList.add('nolab')); return; }
    const focusOn = svg.classList.contains('focus');
    const active = n => !focusOn || n.lit || n.id === selected;
    const obst = vis.filter(active).map(n => [n.x - n.r, n.y - n.r, n.x + n.r, n.y + n.r, n]);
    const cand = vis.filter(active).sort((a, b) => pri(b) - pri(a));
    const placed = [];
    const clash = (b, self) => placed.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1])
      || obst.some(o => o[4] !== self && b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const shown = new Set();
    for (const n of cand) {
      const fs = FS[n.p.kind] * inv, w = n.p.id.length * fs + 3 * inv, h = fs * 1.18, g = n.r + (n.p.tag ? 6.5 : 3);
      const opts = [
        ['b', n.x - w / 2, n.y + g, n.x + w / 2, n.y + g + h],
        ['t', n.x - w / 2, n.y - g - h, n.x + w / 2, n.y - g],
        ['r', n.x + g, n.y - h / 2, n.x + g + w, n.y + h / 2],
        ['l', n.x - g - w, n.y - h / 2, n.x - g, n.y + h / 2]
      ];
      let pick = opts.find(o => !clash(o.slice(1), n));
      if (!pick && (n.id === selected || (focusOn && n.lit) || mode === 'chain')) pick = opts[0];
      if (pick) { placed.push(pick.slice(1)); shown.add(n); }
      setLab(n, pick && pick[0], g, h);
    }
    vis.forEach(n => { if (!shown.has(n)) n.el.classList.add('nolab'); });
  }

  /* ---------- 视图变换 ---------- */
  function applyT() {
    root.setAttribute('transform', `translate(${f1(T.x)} ${f1(T.y)}) scale(${T.k.toFixed(3)})`);
    /* 缩小时文字按比例放大一些,屏幕上的字号不至于小到看不清 */
    const ni = Math.min(2.2, Math.max(1, Math.pow(1 / T.k, .65)));
    svg.style.setProperty('--inv', ni.toFixed(3));
    if (Math.abs(ni - inv) > .01) { inv = ni; scheduleLabels(); }
  }
  let anim = 0;
  function animateTo(to, dur = 480) {
    cancelAnimationFrame(anim);
    const from = { ...T }, t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      T.x = from.x + (to.x - from.x) * e; T.y = from.y + (to.y - from.y) * e; T.k = from.k + (to.k - from.k) * e;
      applyT();
      if (t < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }
  function fitTo(pts, instant, top = 0) {
    if (!pts.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    const pad = 60, side = innerWidth > 900 && Drawer.cur ? 380 : 0;
    const bw = Math.max(x1 - x0, 120) + pad * 2, bh = Math.max(y1 - y0, 120) + pad * 2, w = W - side;
    const h = H - top, k = Math.max(.28, Math.min(1.5, w / bw, h / bh));
    const to = { k, x: w / 2 - (x0 + x1) / 2 * k, y: top + h / 2 - (y0 + y1) / 2 * k };
    if (instant) { T = to; applyT(); } else animateTo(to);
  }
  const fitVisible = instant => fitTo(nodes.filter(n => n.vis), instant);
  function centerOn(n) {
    const k = Math.max(T.k, 1.1);
    let cx = W / 2, cy = H / 2;
    if (innerWidth > 900) cx = (W - 360) / 2;
    else if (innerWidth <= 640) {
      /* 手机上抽屉从下方弹出,把人物放到抽屉上方露出的那一截里 */
      const bar = $('.tabs').offsetHeight;
      window.scrollTo({ top: stage.getBoundingClientRect().top + window.scrollY - bar - 4, behavior: 'smooth' });
      cy = Math.max(70, (innerHeight * .34 - bar) / 2);
    }
    animateTo({ k, x: cx - n.x * k, y: cy - n.y * k });
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w && h) { W = w; H = h; }
  }
  function toWorld(cx, cy) {
    const r = svg.getBoundingClientRect();
    return [(cx - r.left - T.x) / T.k, (cy - r.top - T.y) / T.k];
  }

  /* ---------- 构建 DOM ---------- */
  function build() {
    svg.innerHTML = '';
    const defs = svgEl('defs', {}, svg);
    defs.innerHTML = ALL_GROUPS.map(g => `<radialGradient id="neb-${g}"><stop offset="0" style="stop-color:var(--g-${g});stop-opacity:.2"/><stop offset=".55" style="stop-color:var(--g-${g});stop-opacity:.08"/><stop offset="1" style="stop-color:var(--g-${g});stop-opacity:0"/></radialGradient>`).join('');
    root = svgEl('g', {}, svg);
    gNeb = svgEl('g', { class: 'nebulae' }, root);
    gGuide = svgEl('g', { class: 'guides' }, root);
    gE = svgEl('g', {}, root);
    gN = svgEl('g', {}, root);
    gEgo = svgEl('g', { class: 'ego-layer' }, root);
    ALL_GROUPS.forEach(g => {
      const wrap = svgEl('g', { class: 'neb' }, gNeb);
      wrap.style.setProperty('--c', `var(--g-${g})`);
      const c = svgEl('circle', { fill: `url(#neb-${g})` }, wrap);
      const t = svgEl('text', { class: 'neb-name' }, wrap);
      t.textContent = GROUPS[g].name;
      nebs[g] = { g: wrap, c, t };
    });
    const rand = rng(20261003);
    nodes = PEOPLE.map(p => {
      const an = ANCH[p.grp], ang = rand() * Math.PI * 2, rad = 40 + rand() * 110;
      const n = { id: p.id, p, r: RAD[p.kind], lw: p.id.length * FS[p.kind], x: an[0] + Math.cos(ang) * rad, y: an[1] + Math.sin(ang) * rad, vx: 0, vy: 0, vis: true, fx: null, fy: null, lit: false };
      nmap.set(p.id, n);
      return n;
    });
    links = REL.map(e => {
      const g = svgEl('g', { class: 'edge' }, gE);
      g.style.setProperty('--c', `var(--e-${e.type})`);
      g.style.setProperty('--w', WID[e.type]);
      if (TYPES[e.type].dash) g.style.setProperty('--d', TYPES[e.type].dash);
      const hit = svgEl('path', { class: 'edge-hit' }, g);
      const line = svgEl('path', { class: 'edge-line' }, g);
      const lab = svgEl('text', { class: 'edge-lab' }, g);
      lab.textContent = e.label.replace('/', '·');
      const l = { e, g, hit, line, lab, s: nmap.get(e.a), t: nmap.get(e.b), len: LEN[e.type], str: STR[e.type], vis: true, lit: false, onPath: false };
      hit.__l = l;
      lmap.set(e, l);
      return l;
    });
    nodes.forEach(n => {
      const p = n.p;
      const g = svgEl('g', { class: `nd ${p.kind}`, 'data-id': p.id }, gN);
      g.style.setProperty('--c', `var(--g-${p.grp})`);
      g.style.setProperty('--fs', FS[p.kind] + 'px');
      svgEl('circle', { class: 'glow', r: n.r * 2.4 }, g);
      if (p.kind === 'o') { const q = n.r * 1.3; svgEl('path', { class: 'body', d: `M0 ${-q}L${q} 0L0 ${q}L${-q} 0Z` }, g); }
      else svgEl('circle', { class: 'body', r: n.r }, g);
      if (p.kind === 'c') svgEl('circle', { class: 'core', r: n.r * .38 }, g);
      if (p.tag) svgEl('circle', { class: 'ring', r: n.r + 4.6 }, g);
      n.labEl = svgEl('text', { class: 'lab', y: n.r + 3 }, g);
      n.labEl.textContent = p.id;
      n.el = g;
    });
  }

  /* ---------- 过滤与聚焦 ---------- */
  function applyFilters() {
    const partial = state.types.size < TYPE_ORDER.length;
    const onPath = mode === 'chain' ? new Set(pathInfo.steps.map(s => s.e)) : null;
    nodes.forEach(n => {
      let v = state.groups.has(n.p.grp);
      if (!state.servants && n.p.kind === 's') v = false;
      if (state.focus && !state.focus.has(n.id)) v = false;
      n.vis = v;
    });
    links.forEach(l => {
      let v = l.s.vis && l.t.vis && state.types.has(l.e.type);
      if (mode === 'ego' && !egoChords && l.s.id !== egoId && l.t.id !== egoId) v = false;
      if (onPath) v = onPath.has(l.e);
      l.vis = v;
      l.g.classList.toggle('chord', mode === 'ego' && l.s.id !== egoId && l.t.id !== egoId);
    });
    if (partial) {
      const deg = new Set();
      links.forEach(l => { if (l.vis) { deg.add(l.s.id); deg.add(l.t.id); } });
      nodes.forEach(n => { if (n.vis && !deg.has(n.id) && n.id !== selected) n.vis = false; });
    }
    nodes.forEach(n => { n.el.style.display = n.vis ? '' : 'none'; });
    links.forEach(l => { l.g.style.display = l.vis ? '' : 'none'; });
    gNeb.style.display = mode === 'all' ? '' : 'none';
    if (selected && !nmap.get(selected).vis) selected = null;
    $('#gStat').textContent = `${nodes.filter(n => n.vis).length} 人 · ${links.filter(l => l.vis).length} 条关系`;
    applyFocus();
    paint();
    reheat(.45);
  }
  function applyFocus() {
    nodes.forEach(n => { n.lit = false; });
    links.forEach(l => { l.lit = false; l.onPath = false; });
    let active = false;
    const lightFrom = c => {
      nmap.get(c).lit = true;
      adj.get(c).forEach(e => {
        const l = lmap.get(e);
        if (!l.vis) return;
        l.lit = true;
        nmap.get(c === e.a ? e.b : e.a).lit = true;
        l.lab.textContent = relFor(e, c).role;
      });
    };
    if (pathInfo) {
      active = true;
      pathInfo.ids.forEach(id => { nmap.get(id).lit = true; });
      pathInfo.steps.forEach(st => {
        const l = lmap.get(st.e);
        l.lit = true; l.onPath = true;
        l.lab.textContent = relFor(st.e, st.from).role;
      });
    } else if (mode === 'ego') {
      if (hover && hover !== egoId) { active = true; lightFrom(hover); }
    } else {
      const c = selected || hover;
      if (c) { active = true; lightFrom(c); }
    }
    svg.classList.toggle('focus', active);
    nodes.forEach(n => {
      n.el.classList.toggle('lit', n.lit);
      n.el.classList.toggle('sel', n.id === selected || (!!pathInfo && n.id === pathInfo.ids[0]));
    });
    links.forEach(l => {
      l.g.classList.toggle('lit', l.lit);
      l.g.classList.toggle('path', l.onPath);
      if (!l.lit) l.lab.textContent = l.e.label.replace('/', '·');
    });
    if (mode === 'ego') $$('.ego-lab', gEgo).forEach(g => g.classList.toggle('hot', nmap.get(g.dataset.id).lit));
    scheduleLabels();
  }
  function select(id, center) {
    const n = nmap.get(id);
    if (!n) return;
    if (mode === 'ego') { if (id === egoId) Drawer.open(id); else radial(id); return; }
    if (mode === 'chain') { if (state.focus.has(id)) { Drawer.open(id); return; } exitModes(true); }
    if (!n.vis) resetFilters(true);
    selected = id;
    applyFocus();
    Drawer.open(id);
    if (center) centerOn(n);
  }
  function clearSelection() {
    if (mode !== 'all') return;
    selected = null; hover = null;
    applyFocus();
  }
  function setHover(id) {
    if (hover === id) return;
    hover = id;
    if (mode === 'ego' || (!selected && !pathInfo)) applyFocus();
  }

  /* ---------- 浮动提示 ---------- */
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = stage.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let tx = x - r.left + 16, ty = y - r.top + 18;
    if (tx + tw > r.width - 8) tx = x - r.left - tw - 14;
    if (ty + th > r.height - 8) ty = y - r.top - th - 14;
    tip.style.transform = `translate(${Math.round(Math.max(8, tx))}px, ${Math.round(Math.max(8, ty))}px)`;
  }
  const hideTip = () => { tip.hidden = true; };
  function nodeTip(id) {
    const p = byId.get(id), deg = adj.get(id).length;
    const how = mode === 'ego' ? (id === egoId ? '单击看详情' : '单击换到这个人的命盘') : '单击看详情 · 双击进入命盘';
    return `<b><i class="dot" style="--c:var(--g-${p.grp})"></i>${esc(id)}</b>${p.sub ? `<span>${esc(p.sub)}</span>` : ''}<em>${GROUPS[p.grp].name} · ${deg} 条关系${p.tag ? ' · ' + tagName(p.tag) : ''}</em><small>${how}</small>`;
  }
  function edgeTip(e) {
    let s;
    if (e.label.includes('/')) {
      const ra = relFor(e, e.a).role, rb = relFor(e, e.b).role;
      s = `${esc(e.b)} 是 ${esc(e.a)} 的<b>${esc(ra)}</b>`;
      if (ra !== rb) s += `<br>${esc(e.a)} 是 ${esc(e.b)} 的<b>${esc(rb)}</b>`;
    } else s = `${esc(e.a)} 与 ${esc(e.b)} · <b>${esc(e.label)}</b>`;
    return `<em class="ty" style="--c:var(--e-${e.type})">${TYPES[e.type].name}</em><span class="rl">${s}</span>${e.note ? `<small>${esc(e.note)}</small>` : ''}`;
  }

  /* ---------- 命盘 ---------- */
  let pinRaf = 0;
  function pinAnimate(targets, dur = 700) {
    cancelAnimationFrame(pinRaf);
    const starts = new Map();
    targets.forEach((t, n) => starts.set(n, [n.x, n.y]));
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      targets.forEach((t, n) => {
        const s = starts.get(n);
        n.fx = n.x = s[0] + (t[0] - s[0]) * e;
        n.fy = n.y = s[1] + (t[1] - s[1]) * e;
      });
      paint();
      if (k < 1) pinRaf = requestAnimationFrame(tick);
    };
    pinRaf = requestAnimationFrame(tick);
  }
  const pt = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  function arcD(cx, cy, r, a0, a1) {
    const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1), big = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return `M${f1(x0)} ${f1(y0)}A${f1(r)} ${f1(r)} 0 ${big} ${a1 > a0 ? 1 : 0} ${f1(x1)} ${f1(y1)}`;
  }
  function wedgeD(cx, cy, r0, r1, a0, a1) {
    const [x0, y0] = pt(cx, cy, r1, a1), big = a1 - a0 > Math.PI ? 1 : 0;
    return `${arcD(cx, cy, r0, a0, a1)}L${f1(x0)} ${f1(y0)}A${f1(r1)} ${f1(r1)} 0 ${big} 0 ${f1(pt(cx, cy, r1, a0)[0])} ${f1(pt(cx, cy, r1, a0)[1])}Z`;
  }
  function radial(id, viaCrumb) {
    const c = nmap.get(id);
    if (!c) return;
    if (mode === 'chain') exitModes(true);
    if (mode !== 'ego') egoTrail = [];
    const at = egoTrail.indexOf(id);
    egoTrail = at >= 0 ? egoTrail.slice(0, at + 1) : [...egoTrail, id].slice(-6);
    void viaCrumb;
    nodes.forEach(n => { n.fx = n.fy = null; });
    /* 同一个人和中心可能有几条关系,取排在前面的类型定扇区,称谓合在一起 */
    const byN = new Map();
    adj.get(id).forEach(e => { const o = e.a === id ? e.b : e.a; if (!byN.has(o)) byN.set(o, []); byN.get(o).push(e); });
    const items = [...byN].map(([o, es]) => {
      es.sort((x, y) => TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type));
      return { n: nmap.get(o), type: es[0].type, role: [...new Set(es.map(e => relFor(e, id).role))].join('·') };
    });
    const sectors = TYPE_ORDER.map(t => ({ t, list: items.filter(x => x.type === t).sort((a, b) => KIND_RANK[a.n.p.kind] - KIND_RANK[b.n.p.kind] || adj.get(b.n.id).length - adj.get(a.n.id).length) })).filter(s => s.list.length);
    const GAP = .8, slots = Math.max(items.length + sectors.length * GAP, 6), stepA = 2 * Math.PI / slots;
    const R = Math.max(190, slots * 66 / (2 * Math.PI));
    const cx = c.x, cy = c.y, targets = new Map([[c, [cx, cy]]]);
    const ang = s => -Math.PI / 2 + s * stepA;
    let pos = sectors.length ? -sectors[0].list.length / 2 : 0;
    sectors.forEach(s => {
      s.a0 = ang(pos - GAP * .4); s.a1 = ang(pos + s.list.length + GAP * .4);
      s.list.forEach((x, i) => { x.a = ang(pos + i + .5); targets.set(x.n, pt(cx, cy, R, x.a)); });
      pos += s.list.length + GAP;
    });
    mode = 'ego'; egoId = id; selected = id; hover = null; pathInfo = null;
    egoInfo = { cx, cy, R, items, sectors };
    state.focus = new Set([...targets.keys()].map(n => n.id));
    state.types = new Set(TYPE_ORDER); state.groups = new Set(ALL_GROUPS); state.servants = true; state.preset = '';
    svg.classList.add('ego'); svg.classList.remove('chain'); svg.classList.toggle('chords', egoChords);
    syncChips();
    applyFilters();
    pinAnimate(targets);
    drawEgo();
    renderBar();
    /* 手机上抽屉会盖住大半个画面,命盘里先不弹,点上方的"详情"再看 */
    if (innerWidth > 640) Drawer.open(id); else Drawer.close();
    const m = 110;
    fitTo([{ x: cx - R - m, y: cy - R - 50 }, { x: cx + R + m, y: cy + R + 50 }], false, $('#radialBar').offsetHeight + 12);
  }
  function drawEgo() {
    const { cx, cy, R, items, sectors } = egoInfo;
    gGuide.innerHTML = ''; gEgo.innerHTML = '';
    gGuide.style.display = '';
    const Rs = Math.max(92, R * .4);
    svgEl('circle', { class: 'guide', cx, cy, r: R }, gGuide);
    svgEl('circle', { class: 'ego-inner', cx, cy, r: Rs - 12 }, gGuide);
    let ticks = '';
    for (let i = 0; i < 144; i++) {
      const a = i / 144 * 2 * Math.PI, [x0, y0] = pt(cx, cy, Rs - (i % 12 ? 16 : 22), a), [x1, y1] = pt(cx, cy, Rs - 12, a);
      ticks += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
    }
    svgEl('path', { class: 'ego-tick', d: ticks }, gGuide);
    sectors.forEach((s, k) => {
      const col = `var(--e-${s.t})`;
      const w = svgEl('path', { class: 'ego-wedge', d: wedgeD(cx, cy, Rs, R + 30, s.a0, s.a1) }, gGuide);
      w.style.setProperty('--c', col);
      const a = svgEl('path', { class: 'ego-arc', d: arcD(cx, cy, Rs, s.a0, s.a1) }, gGuide);
      a.style.setProperty('--c', col);
      const mid = (s.a0 + s.a1) / 2, low = Math.sin(mid) > .15, rt = Rs + 15, name = `${SHORT[s.t]} ${s.list.length}`;
      if (rt * (s.a1 - s.a0) > name.length * 12 + 10) {
        const pid = `egoArc${k}`;
        svgEl('path', { id: pid, d: low ? arcD(cx, cy, rt + 8, s.a1, s.a0) : arcD(cx, cy, rt, s.a0, s.a1), fill: 'none' }, gGuide);
        const t = svgEl('text', { class: 'ego-sec' }, gGuide);
        t.style.setProperty('--c', col);
        const tp = svgEl('textPath', { href: '#' + pid, startOffset: '50%' }, t);
        tp.textContent = name;
      }
    });
    const me = byId.get(egoId);
    const core = svgEl('g', { class: 'ego-core', transform: `translate(${f1(cx)} ${f1(cy)})` }, gEgo);
    core.style.setProperty('--c', `var(--g-${me.grp})`);
    svgEl('circle', { class: 'o', r: 62 }, core);
    svgEl('circle', { class: 'i', r: 50 }, core);
    const nm = svgEl('text', { class: 'nm', y: -4 }, core);
    nm.textContent = me.id;
    nm.style.fontSize = `${Math.min(28, 84 / me.id.length)}px`;
    svgEl('text', { class: 'ct', y: 22 }, core).textContent = `${items.length} 位相关`;
    items.forEach(x => {
      const ca = Math.cos(x.a), sa = Math.sin(x.a), [px, py] = pt(cx, cy, R + x.n.r + (x.n.p.tag ? 13 : 9), x.a);
      const g = svgEl('g', { class: 'ego-lab', 'data-id': x.n.id }, gEgo);
      g.style.setProperty('--c', `var(--e-${x.type})`);
      g.style.setProperty('--fs', FS[x.n.p.kind] + 'px');
      let t;
      if (Math.abs(ca) > .34) {
        t = svgEl('text', { x: f1(px), y: f1(py), class: 'side', 'text-anchor': ca > 0 ? 'start' : 'end' }, g);
        svgEl('tspan', { class: 'en' }, t).textContent = x.n.id;
        svgEl('tspan', { class: 'er', dx: '.4em' }, t).textContent = x.role;
      } else if (sa < 0) {
        t = svgEl('text', { x: f1(px), y: f1(py), 'text-anchor': 'middle' }, g);
        svgEl('tspan', { class: 'en', x: f1(px), dy: '-1.15em' }, t).textContent = x.n.id;
        svgEl('tspan', { class: 'er', x: f1(px), dy: '1.3em' }, t).textContent = x.role;
      } else {
        t = svgEl('text', { x: f1(px), y: f1(py), class: 'below', 'text-anchor': 'middle' }, g);
        svgEl('tspan', { class: 'en', x: f1(px) }, t).textContent = x.n.id;
        svgEl('tspan', { class: 'er', x: f1(px), dy: '1.35em' }, t).textContent = x.role;
      }
    });
  }
  function renderBar() {
    const bar = $('#radialBar');
    if (mode === 'ego') {
      bar.innerHTML = `<span class="rb-k">命盘</span><span class="crumbs">${egoTrail.map((t, i) => i === egoTrail.length - 1 ? `<b>${esc(t)}</b>` : `<button type="button" data-crumb="${esc(t)}">${esc(t)}</button><i>›</i>`).join('')}</span>`
        + `<button class="btn" type="button" data-bar="info">详情</button><button class="btn" type="button" data-bar="chords" aria-pressed="${egoChords}">${egoChords ? '隐去' : '显示'}圈内彼此的关系</button><button class="btn" type="button" data-bar="exit">回到全景</button>`;
    } else if (mode === 'chain') {
      const ids = pathInfo.ids;
      bar.innerHTML = `<span class="rb-k">关系链</span><span><b>${esc(ids[0])}</b> 到 <b>${esc(ids[ids.length - 1])}</b> · ${pathInfo.steps.length} 步</span><button class="btn" type="button" data-bar="exit">回到全景</button>`;
    }
    bar.hidden = mode === 'all';
  }
  function exitModes(silent) {
    if (mode === 'all') return;
    const was = mode;
    mode = 'all'; egoId = null; egoInfo = null; hover = null;
    cancelAnimationFrame(pinRaf);
    nodes.forEach(n => { n.fx = n.fy = null; });
    gGuide.innerHTML = ''; gEgo.innerHTML = '';
    svg.classList.remove('ego', 'chain', 'chords');
    $('#radialBar').hidden = true;
    hideTip();
    if (was === 'chain') { pathInfo = null; $('#pathOut').innerHTML = ''; }
    if (!silent) { const keep = was === 'ego' ? selected : null; resetFilters(); if (keep) { selected = keep; applyFocus(); } }
  }

  /* ---------- 筛选控件 ---------- */
  function syncChips() {
    $$('#gTypes .chip').forEach(c => c.classList.toggle('off', !state.types.has(c.dataset.k)));
    $$('#gGroups .chip[data-k]').forEach(c => c.classList.toggle('off', !state.groups.has(c.dataset.k)));
    $('#gServ').classList.toggle('off', !state.servants);
    $$('#gPresets .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.k === state.preset)));
    $('#gLayout').textContent = state.layout === 'family' ? '布局 按家族聚拢' : '布局 自由漂浮';
  }
  function resetFilters(keepFit) {
    state.types = new Set(TYPE_ORDER); state.groups = new Set(ALL_GROUPS);
    state.servants = true; state.focus = null; state.preset = 'all';
    syncChips(); applyFilters();
    if (!keepFit) fitVisible();
  }
  const nb = id => new Set([id, ...adj.get(id).map(e => e.a === id ? e.b : e.a)]);
  const PRESETS = [
    { k: 'all', label: '全景' },
    { k: 'baoyu', label: '宝玉的世界', nodes: () => nb('贾宝玉') },
    { k: 'trio', label: '钗黛与金玉木石', nodes: () => new Set(['贾宝玉', '林黛玉', '薛宝钗', '史湘云', '袭人', '晴雯', '紫鹃', '莺儿', '雪雁', '贾母', '王夫人', '薛姨妈', '贾政', '通灵宝玉', '金锁', '神瑛侍者', '绛珠仙草', '警幻仙子', '茫茫大士', '渺渺真人', '妙玉', '贾探春', '甄宝玉']) },
    { k: 'twelve', label: '十二钗与亲人', nodes: () => { const s = new Set(); PEOPLE.filter(p => p.tag).forEach(p => nb(p.id).forEach(o => { if (o === p.id || byId.get(o).kind !== 's') s.add(o); })); return s; } },
    { k: 'feng', label: '凤姐的网', nodes: () => nb('王熙凤') },
    { k: 'ning', label: '宁府风云', nodes: () => { const s = new Set(PEOPLE.filter(p => p.grp === 'ning').map(p => p.id)); ['贾珍', '秦可卿', '尤二姐', '尤三姐', '贾蓉'].forEach(i => nb(i).forEach(x => s.add(x))); return s; } },
    { k: 'marry', label: '婚姻网', types: ['m'] },
    { k: 'serv', label: '主仆链', types: ['sv'] },
    { k: 'myth', label: '前世神缘', types: ['my', 'lv'], nodes: () => { const s = new Set(['贾宝玉', '林黛玉', '薛宝钗']); REL.filter(e => e.type === 'my').forEach(e => { s.add(e.a); s.add(e.b); }); return s; } }
  ];
  function applyPreset(p) {
    exitModes(true);
    clearPath(true);
    selected = null; hover = null;
    Drawer.close();
    if (p.k === 'all') { resetFilters(); return; }
    state.preset = p.k;
    state.types = new Set(p.types || TYPE_ORDER);
    state.groups = new Set(ALL_GROUPS);
    state.servants = true;
    state.focus = p.nodes ? p.nodes() : null;
    syncChips(); applyFilters();
    setTimeout(() => fitVisible(), 60);
  }
  function buildControls() {
    $('#gTypes').innerHTML = '<span class="lab">关系</span>' + TYPE_ORDER.map(k =>
      `<button class="chip" type="button" data-k="${k}" style="--c:var(--e-${k})" title="点击显示或隐藏"><i class="line-sample" ${TYPES[k].dash ? 'style="border-top-style:dashed"' : ''}></i>${TYPES[k].name}</button>`).join('');
    const cnt = {};
    PEOPLE.forEach(p => { cnt[p.grp] = (cnt[p.grp] || 0) + 1; });
    $('#gGroups').innerHTML = '<span class="lab">家族</span>' + ALL_GROUPS.map(k =>
      `<button class="chip" type="button" data-k="${k}" title="${GROUPS[k].hint}"><i class="dot" style="--c:var(--g-${k})"></i>${GROUPS[k].name} ${cnt[k]}</button>`).join('')
      + '<button class="chip" type="button" id="gServ" title="隐藏次要的仆役与小人物">含仆役与小角色</button>';
    $('#gPresets').innerHTML = PRESETS.map(p => `<button class="chip" type="button" data-k="${p.k}" aria-pressed="${p.k === 'all'}">${p.label}</button>`).join('');
    const leave = () => { if (mode !== 'all') exitModes(true); };
    $('#gTypes').addEventListener('click', ev => {
      const c = ev.target.closest('.chip'); if (!c) return;
      leave();
      const k = c.dataset.k; state.types.has(k) ? state.types.delete(k) : state.types.add(k);
      state.preset = ''; syncChips(); applyFilters();
    });
    $('#gGroups').addEventListener('click', ev => {
      const c = ev.target.closest('.chip'); if (!c) return;
      leave();
      if (c.id === 'gServ') state.servants = !state.servants;
      else { const k = c.dataset.k; state.groups.has(k) ? state.groups.delete(k) : state.groups.add(k); }
      state.preset = ''; syncChips(); applyFilters();
    });
    $('#gPresets').addEventListener('click', ev => {
      const c = ev.target.closest('.chip'); if (!c) return;
      applyPreset(PRESETS.find(x => x.k === c.dataset.k));
    });
    $('#gLayout').addEventListener('click', () => { leave(); state.layout = state.layout === 'family' ? 'free' : 'family'; syncChips(); reheat(.8); });
    $('#gFit').addEventListener('click', () => fitVisible());
    $('#zIn').addEventListener('click', () => zoomBy(1.35));
    $('#zOut').addEventListener('click', () => zoomBy(1 / 1.35));
    $('#zFit').addEventListener('click', () => (mode === 'ego' ? fitTo([{ x: egoInfo.cx - egoInfo.R - 110, y: egoInfo.cy - egoInfo.R - 50 }, { x: egoInfo.cx + egoInfo.R + 110, y: egoInfo.cy + egoInfo.R + 50 }], false, $('#radialBar').offsetHeight + 12) : fitVisible()));
    $('#radialBar').addEventListener('click', ev => {
      const b = ev.target.closest('[data-crumb],[data-bar]');
      if (!b) return;
      if (b.dataset.crumb) radial(b.dataset.crumb, true);
      else if (b.dataset.bar === 'exit') exitModes();
      else if (b.dataset.bar === 'info') Drawer.open(egoId);
      else if (b.dataset.bar === 'chords') {
        egoChords = !egoChords;
        svg.classList.toggle('chords', egoChords);
        applyFilters();
        renderBar();
      }
    });
    bindSearch($('#gSearch'), $('#gSuggest'), id => select(id, true));
    syncChips();
  }
  function zoomBy(f) {
    const k = Math.max(.25, Math.min(4, T.k * f)), cx = W / 2, cy = H / 2;
    animateTo({ k, x: cx - (cx - T.x) / T.k * k, y: cy - (cy - T.y) / T.k * k }, 220);
  }

  /* ---------- 关系速查:亲缘关系代价更低,优先走家人这条线 ---------- */
  function findPath(a, b) {
    const dist = new Map([[a, 0]]), prev = new Map(), done = new Set();
    while (true) {
      let x = null, best = Infinity;
      dist.forEach((d, k) => { if (!done.has(k) && d < best) { best = d; x = k; } });
      if (x === null || x === b) break;
      done.add(x);
      for (const e of adj.get(x)) {
        const y = e.a === x ? e.b : e.a, nd = best + COST[e.type];
        if (nd < (dist.get(y) ?? Infinity)) { dist.set(y, nd); prev.set(y, { from: x, e }); }
      }
    }
    if (!prev.has(b)) return null;
    const steps = [];
    for (let cur = b; prev.has(cur); cur = prev.get(cur).from) { const p = prev.get(cur); steps.unshift({ from: p.from, to: cur, e: p.e }); }
    return steps;
  }
  function showPath(a, b) {
    const out = $('#pathOut');
    if (!byId.has(a) || !byId.has(b)) { out.textContent = '请从联想列表里选择两位人物。'; return; }
    if (a === b) { out.textContent = '这是同一个人。'; return; }
    const steps = findPath(a, b);
    if (!steps) { out.textContent = '这两位人物之间没有找到关系链。'; return; }
    exitModes(true);
    resetFilters(true);
    selected = null; hover = null;
    Drawer.close();
    pathInfo = { steps, ids: [a, ...steps.map(s => s.to)] };
    mode = 'chain';
    svg.classList.add('chain');
    state.focus = new Set(pathInfo.ids);
    state.preset = '';
    syncChips();
    applyFilters();
    /* 把链上的人从左到右排成一行,间距按称谓长短留够 */
    const ns = pathInfo.ids.map(id => nmap.get(id));
    const cx = ns.reduce((s, n) => s + n.x, 0) / ns.length, cy = ns.reduce((s, n) => s + n.y, 0) / ns.length;
    const gaps = steps.map(st => Math.max(170, relFor(st.e, st.from).role.length * 16 + 120));
    const total = gaps.reduce((s, g) => s + g, 0);
    let x = cx - total / 2;
    const targets = new Map();
    ns.forEach((n, i) => { targets.set(n, [x, cy]); x += gaps[i] || 0; });
    pinAnimate(targets);
    renderBar();
    out.innerHTML = `<span class="who" data-pick="${esc(a)}">${esc(a)}</span>` + steps.map(s =>
      `<span class="arrow" style="--c:var(--e-${s.e.type})">${esc(relFor(s.e, s.from).role)} →</span><span class="who" data-pick="${esc(s.to)}">${esc(s.to)}</span>`).join('')
      + `<span class="pnote">共 ${steps.length} 步。箭头上的称谓,指右边的人是左边那位的什么人。</span>`;
    fitTo([...targets.values()].map(([px, py]) => ({ x: px, y: py })), false, $('#radialBar').offsetHeight + 12);
    stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function clearPath(silent) {
    if (mode === 'chain') { exitModes(silent); return; }
    if (!pathInfo) return;
    pathInfo = null;
    $('#pathOut').innerHTML = '';
    if (!silent) applyFocus();
  }
  function buildPath() {
    bindSearch($('#pathA'), $('#pathASug'), () => {});
    bindSearch($('#pathB'), $('#pathBSug'), () => {});
    $('#pathGo').addEventListener('click', () => showPath($('#pathA').value.trim(), $('#pathB').value.trim()));
    $('#pathClear').addEventListener('click', () => { clearPath(); $('#pathA').value = ''; $('#pathB').value = ''; });
    $('#pathEx').addEventListener('click', () => {
      const ex = [['贾宝玉', '刘姥姥'], ['林黛玉', '夏金桂'], ['妙玉', '焦大'], ['香菱', '贾雨村'], ['史湘云', '秦钟']];
      const [a, b] = ex[Math.floor(Math.random() * ex.length)];
      $('#pathA').value = a; $('#pathB').value = b; showPath(a, b);
    });
  }

  /* ---------- 指针交互 ---------- */
  function bindPointer() {
    const ptrs = new Map();
    let drag = null, lastTap = { id: null, t: 0 };
    const target = el => el.closest('.nd, .ego-lab');
    svg.addEventListener('pointerdown', ev => {
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* 合成事件无法捕获指针 */ }
      hideTip();
      ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      cancelAnimationFrame(anim);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        drag = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), k0: T.k, tx: T.x, ty: T.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, moved: true };
        return;
      }
      const nd = target(ev.target);
      drag = nd
        ? { type: 'node', id: nd.dataset.id, sx: ev.clientX, sy: ev.clientY, moved: false }
        : { type: 'pan', sx: ev.clientX, sy: ev.clientY, tx: T.x, ty: T.y, moved: false };
    });
    svg.addEventListener('pointermove', ev => {
      if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (!drag) {
        if (ev.pointerType !== 'mouse') return;
        const nd = target(ev.target);
        setHover(nd ? nd.dataset.id : null);
        if (nd) showTip(nodeTip(nd.dataset.id), ev.clientX, ev.clientY);
        else if (ev.target.classList.contains('edge-hit')) showTip(edgeTip(ev.target.__l.e), ev.clientX, ev.clientY);
        else hideTip();
        return;
      }
      if (drag.type === 'pinch') {
        if (ptrs.size < 2) return;
        const [a, b] = [...ptrs.values()];
        const k = Math.max(.25, Math.min(4, drag.k0 * Math.hypot(a.x - b.x, a.y - b.y) / drag.d0));
        const r = svg.getBoundingClientRect(), cx = drag.mx - r.left, cy = drag.my - r.top;
        T.k = k; T.x = cx - (cx - drag.tx) / drag.k0 * k; T.y = cy - (cy - drag.ty) / drag.k0 * k;
        applyT(); return;
      }
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      if (drag.type === 'pan') { T.x = drag.tx + dx; T.y = drag.ty + dy; svg.classList.add('panning'); applyT(); }
      else if (mode === 'all') {
        const n = nmap.get(drag.id), [wx, wy] = toWorld(ev.clientX, ev.clientY);
        n.fx = n.x = wx; n.fy = n.y = wy;
        reheat(.3); paint();
      }
    });
    const up = ev => {
      ptrs.delete(ev.pointerId);
      svg.classList.remove('panning');
      if (!drag) return;
      const d = drag;
      if (ptrs.size === 0 || d.type === 'pinch') drag = null;
      if (d.type === 'node') {
        const n = nmap.get(d.id);
        if (mode === 'all') { n.fx = null; n.fy = null; }
        if (!d.moved) {
          const now = performance.now();
          if (mode !== 'all') select(d.id, false);
          else if (lastTap.id === d.id && now - lastTap.t < 380) { radial(d.id); lastTap = { id: null, t: 0 }; }
          else { select(d.id, false); lastTap = { id: d.id, t: now }; }
        }
      } else if (d.type === 'pan' && !d.moved && mode === 'all') {
        clearSelection(); Drawer.close();
      }
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse' && !drag) { setHover(null); hideTip(); } });
    svg.addEventListener('wheel', ev => {
      ev.preventDefault();
      hideTip();
      const r = svg.getBoundingClientRect();
      const k = Math.max(.25, Math.min(4, T.k * Math.exp(-ev.deltaY * (ev.ctrlKey ? .01 : .0014))));
      const cx = ev.clientX - r.left, cy = ev.clientY - r.top;
      cancelAnimationFrame(anim);
      T.x = cx - (cx - T.x) / T.k * k; T.y = cy - (cy - T.y) / T.k * k; T.k = k;
      applyT();
    }, { passive: false });
  }

  function init() {
    if (innerWidth <= 640) $('#gFold').open = false;
    resize();
    build();
    buildControls();
    buildPath();
    bindPointer();
    alpha = 1;
    for (let i = 0; i < 700; i++) step();
    alpha = .02;
    applyFilters();
    fitVisible(true);
    ready = true;
    new ResizeObserver(() => { const ow = W, oh = H; resize(); if (ready && mode === 'all' && (Math.abs(ow - W) > 40 || Math.abs(oh - H) > 40)) fitVisible(true); }).observe(stage);
  }
  return { init, resize, select, clearSelection, radial };
})();
