/* ============ 关系星图 ============
   全景是力导向布局，每个家族有自己的锚点和一团底色。名字按空隙自动显示，挤不下的先藏起来，放大后会陆续出现。
   点一个人，与之相连的人亮起来；再点一次（或选“命盘”）进入命盘：关系按类型分扇区，一人一个方位，
   连线都是从中心发出的直线，上下两侧的名字竖排。关系链把两人之间的关系拉成一条线。
   手机上页面里的星图只是预览，轻点进入全屏，拖动、双指缩放、点选都在全屏里做。 */
const Graph = (() => {
  const svg = $('#gsvg');
  const stage = $('#stage');
  const tip = $('#gTip');
  const ALL_GROUPS = Object.keys(GROUPS);
  let W = 900, H = 600;
  let T = { x: 0, y: 0, k: 1 }, inv = 1;
  let root, gSky, gNeb, gGuide, gE, gN, gEgo;
  let nodes = [], links = [];
  const nmap = new Map(), lmap = new Map(), nebs = {};
  let alpha = 0, raf = 0, ready = false;
  const state = { types: new Set(TYPE_ORDER), groups: new Set(ALL_GROUPS), servants: true, focus: null, layout: 'family', preset: 'all' };
  let selected = null, hover = null, pathInfo = null;
  /* mode: all 全景 · ego 命盘 · chain 关系链 */
  let mode = 'all', egoId = null, egoInfo = null, egoTrail = [], egoChords = false;
  let full = false, anch = null, chainPts = null, chainVert = false, tipPinned = false;
  const coarse = matchMedia('(pointer: coarse)'), compact = matchMedia('(max-width: 900px)');
  /* 手机与小平板：页面里只做预览，手势都留给全屏 */
  const previewOnly = () => coarse.matches && compact.matches;

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
  /* 缩小时文字按比例放大一些，屏幕上的字号不至于小到看不清；手机屏幕小，补得更多 */
  const invFor = k => Math.min(compact.matches ? 2.8 : 2.2, Math.max(1, Math.pow(1 / k, compact.matches ? .8 : .65)));

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
        /* 两个名字左右挨着、上下又几乎同高时，往上下错开一点 */
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
      const an = anch[n.p.grp], kk = n.p.grp === 'rong' ? kc * .3 : kc;
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
    const vert = mode === 'chain' && chainVert;
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
      /* 竖着的关系链，称谓写在线的左边 */
      l.lab.setAttribute('x', f1((x1 + 2 * cx + x2) / 4 - (vert ? 12 : 0)));
      l.lab.setAttribute('y', f1((y1 + 2 * cy + y2) / 4 - (vert ? -4 : 4)));
      l.lab.style.textAnchor = vert ? 'end' : '';
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

  /* ---------- 家族星云：每家一团淡淡的底色，上面写家名 ---------- */
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

  /* ---------- 名字摆放：按重要程度依次找空位，下、上、右、左都放不下就先藏起来 ---------- */
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
    const order = mode === 'chain' && chainVert ? [2, 3, 0, 1] : [0, 1, 2, 3];
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
      const tries = order.map(i => opts[i]);
      let pick = tries.find(o => !clash(o.slice(1), n));
      if (!pick && (n.id === selected || (focusOn && n.lit) || mode === 'chain')) pick = tries[0];
      if (pick) { placed.push(pick.slice(1)); shown.add(n); }
      setLab(n, pick && pick[0], g, h);
    }
    vis.forEach(n => { if (!shown.has(n)) n.el.classList.add('nolab'); });
  }

  /* ---------- 视图变换 ---------- */
  function applyT() {
    root.setAttribute('transform', `translate(${f1(T.x)} ${f1(T.y)}) scale(${T.k.toFixed(3)})`);
    const ni = invFor(T.k);
    svg.style.setProperty('--inv', ni.toFixed(3));
    if (Math.abs(ni - inv) > .01) { inv = ni; scheduleLabels(); }
  }
  let anim = 0, glide = 0;
  function animateTo(to, dur = 520) {
    cancelAnimationFrame(anim); cancelAnimationFrame(glide);
    const from = { ...T }, t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      T.x = from.x + (to.x - from.x) * e; T.y = from.y + (to.y - from.y) * e; T.k = from.k + (to.k - from.k) * e;
      applyT();
      if (t < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }
  function setT(to, instant) {
    if (instant) { cancelAnimationFrame(anim); T = to; applyT(); } else animateTo(to);
  }
  /* 画面上被浮层和人物卡片挡住的部分，摆放时要让开 */
  function insets() {
    const sr = stage.getBoundingClientRect();
    const ins = { t: 10, b: 10, l: 10, r: 10 };
    ['.sg-top', '.sg-sub', '#gPath', '#gModes'].forEach(s => {
      const el = $(s, stage);
      if (!el || el.hidden || !el.offsetWidth) return;
      const er = el.getBoundingClientRect();
      /* 手机上模式切换浮在人物卡片上方，它正在随卡片移动，按卡片的最终高度来算 */
      if (s === '#gModes' && Drawer.sheet.matches) { ins.b = Math.max(ins.b, Drawer.coverBottom() - (innerHeight - sr.bottom) + er.height + 24); return; }
      if (er.top - sr.top < sr.height / 2) ins.t = Math.max(ins.t, er.bottom - sr.top + 8);
      else ins.b = Math.max(ins.b, sr.bottom - er.top + 8);
    });
    const cb = Drawer.coverBottom(), cr = Drawer.coverRight();
    if (cb) ins.b = Math.max(ins.b, cb - (innerHeight - sr.bottom) + 8);
    if (cr) ins.r = Math.max(ins.r, sr.right - (innerWidth - cr) + 8);
    return ins;
  }
  function fitBox(x0, y0, x1, y1, instant, pad = 50) {
    const ins = insets(), w = Math.max(80, W - ins.l - ins.r), h = Math.max(80, H - ins.t - ins.b);
    const bw = Math.max(x1 - x0, 120) + pad * 2, bh = Math.max(y1 - y0, 120) + pad * 2;
    const k = Math.max(.2, Math.min(1.5, w / bw, h / bh));
    setT({ k, x: ins.l + w / 2 - (x0 + x1) / 2 * k, y: ins.t + h / 2 - (y0 + y1) / 2 * k }, instant);
  }
  function fitPts(pts, instant, pad) {
    if (!pts.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    fitBox(x0, y0, x1, y1, instant, pad);
  }
  const fitVisible = instant => fitPts(nodes.filter(n => n.vis), instant, 60);
  /* 命盘的外框取决于字号，字号又取决于缩放，来回算两三次就稳了 */
  function fitEgo(instant) {
    const { cx, cy, R } = egoInfo, ins = insets();
    const w = Math.max(80, W - ins.l - ins.r), h = Math.max(80, H - ins.t - ins.b);
    let k = T.k, box = null;
    for (let i = 0; i < 3; i++) {
      svg.style.setProperty('--inv', invFor(k).toFixed(3));
      const b = gEgo.getBBox(), o = R + 34;
      box = [Math.min(b.x, cx - o), Math.min(b.y, cy - o), Math.max(b.x + b.width, cx + o), Math.max(b.y + b.height, cy + o)];
      k = Math.max(.2, Math.min(1.4, w / (box[2] - box[0] + 36), h / (box[3] - box[1] + 36)));
    }
    svg.style.setProperty('--inv', inv.toFixed(3));
    setT({ k, x: ins.l + w / 2 - (box[0] + box[2]) / 2 * k, y: ins.t + h / 2 - (box[1] + box[3]) / 2 * k }, instant);
  }
  function refit(instant) {
    if (mode === 'ego' && egoInfo) fitEgo(instant);
    else if (mode === 'chain' && chainPts) fitPts(chainPts, instant, 70);
    else fitVisible(instant);
  }
  function centerOn(n) {
    const ins = insets(), k = Math.max(T.k, compact.matches ? .72 : 1.1);
    const cx = ins.l + (W - ins.l - ins.r) / 2, cy = ins.t + (H - ins.t - ins.b) / 2;
    animateTo({ k, x: cx - n.x * k, y: cy - n.y * k });
  }
  function zoomAt(px, py, f) {
    const k = Math.max(.2, Math.min(4, T.k * f));
    animateTo({ k, x: px - (px - T.x) / T.k * k, y: py - (py - T.y) / T.k * k }, 260);
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w && h) { W = w; H = h; }
  }
  function toWorld(cx, cy) {
    const r = svg.getBoundingClientRect();
    return [(cx - r.left - T.x) / T.k, (cy - r.top - T.y) / T.k];
  }

  /* ---------- 全屏 ---------- */
  function setFull(on, fromPop, noFit) {
    if (on === full) return;
    full = on;
    stage.classList.toggle('full', on);
    document.documentElement.classList.toggle('stage-full', on);
    $('#zFull').setAttribute('aria-label', on ? '退出全屏' : '全屏');
    /* 手机的返回键用来退出全屏 */
    if (on) { try { history.pushState({ hlmStage: 1 }, ''); } catch (e) { /* 沙箱里改不了历史时忽略 */ } }
    else if (!fromPop && history.state && history.state.hlmStage) { try { history.back(); } catch (e) { /* 同上 */ } }
    hideTip();
    toggleFilter(false);
    if (!on && Drawer.sheet.matches) Drawer.close();
    resize();
    if (!noFit) refit(true);
  }

  /* ---------- 构建 DOM ---------- */
  function build() {
    svg.innerHTML = '';
    const defs = svgEl('defs', {}, svg);
    defs.innerHTML = ALL_GROUPS.map(g => `<radialGradient id="neb-${g}"><stop offset="0" style="stop-color:var(--g-${g});stop-opacity:.2"/><stop offset=".55" style="stop-color:var(--g-${g});stop-opacity:.08"/><stop offset="1" style="stop-color:var(--g-${g});stop-opacity:0"/></radialGradient>`).join('');
    root = svgEl('g', {}, svg);
    gSky = svgEl('g', { class: 'sky' }, root);
    gNeb = svgEl('g', { class: 'nebulae' }, root);
    gGuide = svgEl('g', { class: 'guides' }, root);
    gE = svgEl('g', {}, root);
    gN = svgEl('g', {}, root);
    gEgo = svgEl('g', { class: 'ego-layer' }, root);
    /* 星图底下一层同心圆与经线，像旧星图上的刻度 */
    const av = Object.values(anch), sx = av.reduce((s, a) => s + a[0], 0) / av.length, sy = av.reduce((s, a) => s + a[1], 0) / av.length;
    for (let r = 240; r <= 1440; r += 240) svgEl('circle', { class: r === 1200 ? 'sky-ring main' : 'sky-ring', cx: f1(sx), cy: f1(sy), r }, gSky);
    let rays = '', ticks = '';
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      rays += `M${f1(sx + c * 240)} ${f1(sy + s * 240)}L${f1(sx + c * 1440)} ${f1(sy + s * 1440)}`;
    }
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), r0 = i % 5 ? 1186 : 1172;
      ticks += `M${f1(sx + c * r0)} ${f1(sy + s * r0)}L${f1(sx + c * 1200)} ${f1(sy + s * 1200)}`;
    }
    svgEl('path', { class: 'sky-ray', d: rays }, gSky);
    svgEl('path', { class: 'sky-tick', d: ticks }, gSky);
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
      const an = anch[p.grp], ang = rand() * Math.PI * 2, rad = 40 + rand() * 110;
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
    gNeb.style.display = gSky.style.display = mode === 'all' ? '' : 'none';
    if (selected && !nmap.get(selected).vis) selected = null;
    const stat = `${nodes.filter(n => n.vis).length} 人 · ${links.filter(l => l.vis).length} 条关系`;
    $('#gStat').textContent = stat;
    $('#gStat2').textContent = stat;
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
  const card = id => Drawer.open(id, { snap: full ? 'peek' : undefined, ego: mode === 'ego' && id === egoId });
  function select(id, center) {
    const n = nmap.get(id);
    if (!n) return;
    if (mode === 'ego') { if (id === egoId) card(id); else radial(id); return; }
    if (mode === 'chain') { if (state.focus.has(id)) { card(id); return; } exitModes(true); }
    if (!n.vis) resetFilters(true);
    selected = id;
    applyFocus();
    card(id);
    /* 'fit'：把这个人连同亮起来的亲友一起框进画面，手机上点人就能看清 */
    if (center === 'fit') fitPts(nodes.filter(m => m.lit || m === n), false, 34);
    else if (center) centerOn(n);
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
  /* 从页面别处（抽屉、人物谱）跳进星图：手机上先进全屏 */
  function focus(id, how) {
    if (previewOnly() && !full) setFull(true, false, true);
    if (how === 'ego') radial(id); else select(id, true);
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
  const hideTip = () => { tip.hidden = true; tipPinned = false; };
  function nodeTip(id) {
    const p = byId.get(id), deg = adj.get(id).length;
    const how = mode === 'ego' ? (id === egoId ? '点击看详情' : '点击换到这个人的命盘')
      : id === selected ? '再点一次，以这个人为中心排开' : '点击看关系 · 再点一次进入命盘';
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
  function radial(id) {
    const c = nmap.get(id);
    if (!c) return;
    toggleFilter(false);
    if (mode === 'chain') exitModes(true);
    $('#gPath').hidden = true;
    if (mode !== 'ego') egoTrail = [];
    const at = egoTrail.indexOf(id);
    egoTrail = at >= 0 ? egoTrail.slice(0, at + 1) : [...egoTrail, id].slice(-6);
    nodes.forEach(n => { n.fx = n.fy = null; });
    /* 同一个人和中心可能有几条关系，取排在前面的类型定扇区，称谓合在一起 */
    const byN = new Map();
    adj.get(id).forEach(e => { const o = e.a === id ? e.b : e.a; if (!byN.has(o)) byN.set(o, []); byN.get(o).push(e); });
    const items = [...byN].map(([o, es]) => {
      es.sort((x, y) => TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type));
      return { n: nmap.get(o), type: es[0].type, role: [...new Set(es.map(e => relFor(e, id).role))].join('·') };
    });
    const sectors = TYPE_ORDER.map(t => ({ t, list: items.filter(x => x.type === t).sort((a, b) => KIND_RANK[a.n.p.kind] - KIND_RANK[b.n.p.kind] || adj.get(b.n.id).length - adj.get(a.n.id).length) })).filter(s => s.list.length);
    /* 上下两侧竖排以后，相邻两人只要隔开一个字宽，圈可以收得比横排紧 */
    const GAP = .8, slots = Math.max(items.length + sectors.length * GAP, 6), stepA = 2 * Math.PI / slots;
    const R = Math.max(170, slots * 48 / (2 * Math.PI));
    const cx = c.x, cy = c.y, targets = new Map([[c, [cx, cy]]]);
    const ang = s => -Math.PI / 2 + s * stepA;
    let pos = sectors.length ? -sectors[0].list.length / 2 : 0;
    sectors.forEach(s => {
      s.a0 = ang(pos - GAP * .4); s.a1 = ang(pos + s.list.length + GAP * .4);
      s.list.forEach((x, i) => { x.a = ang(pos + i + .5); targets.set(x.n, pt(cx, cy, R, x.a)); });
      pos += s.list.length + GAP;
    });
    mode = 'ego'; egoId = id; selected = id; hover = null; pathInfo = null; chainPts = null;
    egoInfo = { cx, cy, R, items, sectors };
    state.focus = new Set([...targets.keys()].map(n => n.id));
    state.types = new Set(TYPE_ORDER); state.groups = new Set(ALL_GROUPS); state.servants = true; state.preset = '';
    svg.classList.add('ego'); svg.classList.remove('chain'); svg.classList.toggle('chords', egoChords);
    syncChips();
    applyFilters();
    pinAnimate(targets);
    drawEgo();
    renderBar();
    card(id);
    fitEgo(false);
  }
  function drawEgo() {
    const { cx, cy, R, items, sectors } = egoInfo;
    gGuide.innerHTML = ''; gEgo.innerHTML = '';
    gGuide.style.display = '';
    const Rs = Math.max(92, R * .4);
    svgEl('circle', { class: 'guide', cx, cy, r: R }, gGuide);
    svgEl('circle', { class: 'guide outer', cx, cy, r: R + 30 }, gGuide);
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
      if (Math.abs(ca) > .5) {
        const t = svgEl('text', { x: f1(px), y: f1(py), class: 'side', 'text-anchor': ca > 0 ? 'start' : 'end' }, g);
        svgEl('tspan', { class: 'en' }, t).textContent = x.n.id;
        svgEl('tspan', { class: 'er', dx: '.4em' }, t).textContent = x.role;
        return;
      }
      /* 竖排一列：名字在前，称谓小一号接在后面。上半圈整列压在人物上方，下半圈从人物下方往下写 */
      const t = svgEl('text', { x: f1(px), y: f1(py), class: 'vert', 'text-anchor': 'middle' }, g);
      const nm = [...x.n.id], rl = [...x.role], RS = .78, GP = .45;
      const total = nm.length + (rl.length ? GP + rl.length * RS : 0);
      nm.forEach((ch, i) => {
        const dy = i ? 1 : (sa < 0 ? .5 - total : .5);
        svgEl('tspan', { class: 'en', x: f1(px), dy: dy.toFixed(3) + 'em' }, t).textContent = ch;
      });
      rl.forEach((ch, i) => {
        const dy = i ? 1 : (.5 + GP + RS / 2) / RS;
        svgEl('tspan', { class: 'er', x: f1(px), dy: dy.toFixed(3) + 'em' }, t).textContent = ch;
      });
    });
  }
  function renderBar() {
    const bar = $('#radialBar');
    if (mode === 'ego') {
      bar.innerHTML = `<span class="rb-k">命盘</span><span class="crumbs">${egoTrail.map((t, i) => i === egoTrail.length - 1 ? `<b>${esc(t)}</b>` : `<button type="button" data-crumb="${esc(t)}">${esc(t)}</button><i>›</i>`).join('')}</span>`
        + `<button class="rb-btn" type="button" data-bar="chords" aria-pressed="${egoChords}">圈内关系</button>`;
    }
    bar.hidden = mode !== 'ego';
    $('#gPresets').hidden = mode !== 'all' || !$('#gPath').hidden;
    syncModes();
  }
  function syncModes() {
    const m = mode === 'chain' || !$('#gPath').hidden ? 'chain' : mode;
    $$('#gModes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
  }
  function exitModes(silent) {
    if (mode === 'all') return;
    const was = mode;
    mode = 'all'; egoId = null; egoInfo = null; hover = null; chainPts = null;
    cancelAnimationFrame(pinRaf);
    nodes.forEach(n => { n.fx = n.fy = null; });
    gGuide.innerHTML = ''; gEgo.innerHTML = '';
    svg.classList.remove('ego', 'chain', 'chords');
    hideTip();
    if (was === 'chain') { pathInfo = null; $('#pathOut').innerHTML = ''; $('#gPath').hidden = true; }
    renderBar();
    if (!silent) { const keep = was === 'ego' ? selected : null; resetFilters(); if (keep) { selected = keep; applyFocus(); } }
  }

  /* ---------- 筛选与视角 ---------- */
  function syncChips() {
    $$('#gTypes .chip').forEach(c => c.classList.toggle('off', !state.types.has(c.dataset.k)));
    $$('#gGroups .chip[data-k]').forEach(c => c.classList.toggle('off', !state.groups.has(c.dataset.k)));
    $('#gServ').classList.toggle('off', !state.servants);
    $$('#gPresets .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.k === state.preset)));
    $('#gLayout').textContent = state.layout === 'family' ? '布局 按家族聚拢' : '布局 自由漂浮';
    const dirty = state.types.size < TYPE_ORDER.length || state.groups.size < ALL_GROUPS.length || !state.servants;
    $('#gFilterBtn').classList.toggle('dirty', dirty);
  }
  function resetFilters(keepFit) {
    state.types = new Set(TYPE_ORDER); state.groups = new Set(ALL_GROUPS);
    state.servants = true; state.focus = null; state.preset = 'all';
    syncChips(); applyFilters();
    if (!keepFit) fitVisible();
  }
  function toggleFilter(on) {
    const p = $('#gFilter');
    on = on == null ? p.hidden : on;
    p.hidden = !on;
    $('#gFilterBtn').setAttribute('aria-expanded', String(on));
  }
  const nb = id => new Set([id, ...adj.get(id).map(e => e.a === id ? e.b : e.a)]);
  const PRESETS = [
    { k: 'all', label: '全部人物' },
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
    $('#gTypes').innerHTML = TYPE_ORDER.map(k =>
      `<button class="chip" type="button" data-k="${k}" style="--c:var(--e-${k})"><i class="line-sample" ${TYPES[k].dash ? 'style="border-top-style:dashed"' : ''}></i>${TYPES[k].name}</button>`).join('');
    const cnt = {};
    PEOPLE.forEach(p => { cnt[p.grp] = (cnt[p.grp] || 0) + 1; });
    $('#gGroups').innerHTML = ALL_GROUPS.map(k =>
      `<button class="chip" type="button" data-k="${k}" title="${GROUPS[k].hint}"><i class="dot" style="--c:var(--g-${k})"></i>${GROUPS[k].name}<small>${cnt[k]}</small></button>`).join('')
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
    $('#gModes').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      const m = b.dataset.m;
      toggleFilter(false);
      if (m === 'all') {
        if (mode !== 'all') exitModes();
        else if (!$('#gPath').hidden) { $('#gPath').hidden = true; renderBar(); }
        else applyPreset(PRESETS[0]);
      } else if (m === 'ego') {
        if (mode !== 'ego') radial(selected || egoTrail[egoTrail.length - 1] || '贾宝玉');
      } else if ($('#gPath').hidden) openPath();
    });
    $('#gFilterBtn').addEventListener('click', () => toggleFilter());
    $('#gFilter').addEventListener('click', ev => { if (ev.target.closest('[data-close]')) toggleFilter(false); });
    $('#gLayout').addEventListener('click', () => { leave(); state.layout = state.layout === 'family' ? 'free' : 'family'; syncChips(); reheat(.8); });
    $('#gReset').addEventListener('click', () => applyPreset(PRESETS[0]));
    $('#zIn').addEventListener('click', () => zoomAt(W / 2, H / 2, 1.4));
    $('#zOut').addEventListener('click', () => zoomAt(W / 2, H / 2, 1 / 1.4));
    $('#zFit').addEventListener('click', () => refit(false));
    $('#zFull').addEventListener('click', () => setFull(!full));
    $('#gClose').addEventListener('click', () => setFull(false));
    $('#gEnter').addEventListener('click', () => setFull(true));
    $('#radialBar').addEventListener('click', ev => {
      const b = ev.target.closest('[data-crumb],[data-bar]');
      if (!b) return;
      if (b.dataset.crumb) radial(b.dataset.crumb);
      else if (b.dataset.bar === 'chords') {
        egoChords = !egoChords;
        svg.classList.toggle('chords', egoChords);
        applyFilters();
        renderBar();
      }
    });
    bindSearch($('#gSearch'), $('#gSuggest'), id => { $('#gSearch').blur(); select(id, compact.matches ? 'fit' : true); });
    syncChips();
  }

  /* ---------- 关系链：亲缘关系代价更低，优先走家人这条线 ---------- */
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
  function openPath(a) {
    if (previewOnly() && !full) setFull(true, false, true);
    toggleFilter(false);
    if (mode === 'ego') exitModes();
    if (Drawer.sheet.matches) Drawer.close();
    $('#gPath').hidden = false;
    if (a) { $('#pathA').value = a; $('#pathB').value = ''; }
    else if (!$('#pathA').value && selected) $('#pathA').value = selected;
    renderBar();
    /* 手机上不主动弹键盘 */
    if (!coarse.matches) ($('#pathA').value ? $('#pathB') : $('#pathA')).focus();
  }
  function showPath(a, b) {
    const out = $('#pathOut');
    if (!byId.has(a) || !byId.has(b)) { out.innerHTML = '<span class="pnote">请从联想列表里选两位人物。</span>'; return; }
    if (a === b) { out.innerHTML = '<span class="pnote">这是同一个人。</span>'; return; }
    const steps = findPath(a, b);
    if (!steps) { out.innerHTML = '<span class="pnote">这两位之间没有找到关系链。</span>'; return; }
    exitModes(true);
    $('#gPath').hidden = false;
    resetFilters(true);
    selected = null; hover = null;
    Drawer.close();
    pathInfo = { steps, ids: [a, ...steps.map(s => s.to)] };
    mode = 'chain';
    svg.classList.add('chain');
    state.focus = new Set(pathInfo.ids);
    state.preset = '';
    syncChips();
    out.innerHTML = `<span class="who" data-pick="${esc(a)}">${esc(a)}</span>` + steps.map(s =>
      `<span class="arrow" style="--c:var(--e-${s.e.type})">${esc(relFor(s.e, s.from).role)}</span><span class="who" data-pick="${esc(s.to)}">${esc(s.to)}</span>`).join('')
      + `<span class="pnote">共 ${steps.length} 步。每个称谓说的是它后面那位是前面那位的什么人。</span>`;
    renderBar();
    applyFilters();
    /* 链上的人排成一条线：竖屏竖着排，横屏横着排，间距按称谓长短留够 */
    const ns = pathInfo.ids.map(id => nmap.get(id));
    const cx = ns.reduce((s, n) => s + n.x, 0) / ns.length, cy = ns.reduce((s, n) => s + n.y, 0) / ns.length;
    chainVert = H > W * 1.05;
    const gaps = steps.map(st => chainVert ? 118 : Math.max(170, relFor(st.e, st.from).role.length * 16 + 120));
    const total = gaps.reduce((s, g) => s + g, 0);
    let d = -total / 2;
    const targets = new Map();
    ns.forEach((n, i) => { targets.set(n, chainVert ? [cx, cy + d] : [cx + d, cy]); d += gaps[i] || 0; });
    pinAnimate(targets);
    chainPts = [...targets.values()].map(([px, py]) => ({ x: px, y: py }));
    fitPts(chainPts, false, 70);
  }
  function clearPath(silent) {
    if (mode === 'chain') { exitModes(silent); return; }
    if (!pathInfo) return;
    pathInfo = null;
    $('#pathOut').innerHTML = '';
    if (!silent) applyFocus();
  }
  function buildPath() {
    bindSearch($('#pathA'), $('#pathASug'), () => { if (!coarse.matches) $('#pathB').focus(); });
    bindSearch($('#pathB'), $('#pathBSug'), () => { $('#pathB').blur(); showPath($('#pathA').value.trim(), $('#pathB').value.trim()); });
    $('#pathGo').addEventListener('click', () => showPath($('#pathA').value.trim(), $('#pathB').value.trim()));
    $('#pathClear').addEventListener('click', () => { clearPath(); $('#pathA').value = ''; $('#pathB').value = ''; $('#pathOut').innerHTML = ''; });
    $('#pathEx').addEventListener('click', () => {
      const ex = [['贾宝玉', '刘姥姥'], ['林黛玉', '夏金桂'], ['妙玉', '焦大'], ['香菱', '贾雨村'], ['史湘云', '秦钟']];
      const [a, b] = ex[Math.floor(Math.random() * ex.length)];
      $('#pathA').value = a; $('#pathB').value = b; showPath(a, b);
    });
    $('#gPath').addEventListener('click', ev => {
      if (!ev.target.closest('[data-close]')) return;
      if (mode === 'chain') exitModes(); else { $('#gPath').hidden = true; renderBar(); }
    });
  }

  /* ---------- 指针交互 ----------
     鼠标：拖空白平移，拖人物挪位置，滚轮缩放，悬停看提示。
     触屏：单指平移（松手带惯性），双指缩放，点空白两下放大；点人不必点准，附近最近的人会被选中。 */
  function bindPointer() {
    const ptrs = new Map();
    let drag = null, lastTap = { t: 0, x: 0, y: 0 };
    const target = el => el.closest && el.closest('.nd, .ego-lab');
    function nearest(cx, cy, tol) {
      const [wx, wy] = toWorld(cx, cy), focusOn = svg.classList.contains('focus');
      let best = null, bd = tol;
      for (const n of nodes) {
        if (!n.vis) continue;
        let d = (Math.hypot(n.x - wx, n.y - wy) - n.r) * T.k;
        if (focusOn && !n.lit && n.id !== selected) d += 8;
        if (d < bd) { bd = d; best = n.id; }
      }
      return best;
    }
    /* 命盘里的名字是一列字,手指常落在字缝里,按整块名字的外框来认 */
    function labelAt(x, y) {
      if (mode !== 'ego') return null;
      for (const g of $$('.ego-lab', gEgo)) {
        const r = g.getBoundingClientRect();
        if (x > r.left - 6 && x < r.right + 6 && y > r.top - 6 && y < r.bottom + 6) return g.dataset.id;
      }
      return null;
    }
    function tap(ev, touch) {
      const nd = target(ev.target), id = nd ? nd.dataset.id : labelAt(ev.clientX, ev.clientY) || nearest(ev.clientX, ev.clientY, touch ? 24 : 6);
      if (id) {
        hideTip();
        if (mode === 'all' && id === selected) radial(id);
        else select(id, touch && mode === 'all' ? 'fit' : false);
        return;
      }
      const l = ev.target.__l;
      if (touch && l && svg.classList.contains('focus')) { showTip(edgeTip(l.e), ev.clientX, ev.clientY); tipPinned = true; return; }
      const now = performance.now(), r = svg.getBoundingClientRect();
      if (touch && now - lastTap.t < 340 && Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) < 36) {
        zoomAt(ev.clientX - r.left, ev.clientY - r.top, 1.8);
        lastTap.t = 0;
        return;
      }
      lastTap = { t: now, x: ev.clientX, y: ev.clientY };
      if (mode === 'all') { clearSelection(); Drawer.close(); }
    }
    function fling(hist) {
      if (hist.length < 2) return;
      const a = hist[0], b = hist[hist.length - 1], dt = b.t - a.t;
      if (dt <= 0 || performance.now() - b.t > 80) return;
      let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, last = performance.now();
      if (Math.hypot(vx, vy) < .25) return;
      const tick = now => {
        const d = Math.min(40, now - last); last = now;
        T.x += vx * d; T.y += vy * d;
        const f = Math.pow(.93, d / 16); vx *= f; vy *= f;
        applyT();
        if (Math.hypot(vx, vy) > .02) glide = requestAnimationFrame(tick);
      };
      glide = requestAnimationFrame(tick);
    }
    svg.addEventListener('pointerdown', ev => {
      if (ev.button > 0) return;
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* 合成事件无法捕获指针 */ }
      if (!tipPinned) hideTip();
      toggleFilter(false);
      cancelAnimationFrame(anim); cancelAnimationFrame(glide);
      ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        drag = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: T.k, tx: T.x, ty: T.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, moved: true };
        return;
      }
      if (ptrs.size > 2) return;
      const touch = ev.pointerType !== 'mouse';
      const nd = !touch && mode === 'all' ? target(ev.target) : null;
      drag = nd
        ? { type: 'node', id: nd.dataset.id, sx: ev.clientX, sy: ev.clientY, moved: false, touch }
        : { type: 'pan', sx: ev.clientX, sy: ev.clientY, tx: T.x, ty: T.y, moved: false, touch, hist: [] };
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
        const k = Math.max(.2, Math.min(4, drag.k0 * Math.hypot(a.x - b.x, a.y - b.y) / drag.d0));
        const r = svg.getBoundingClientRect(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const cx = drag.mx - r.left, cy = drag.my - r.top;
        /* 双指中点跟着手指走，缩放也以它为中心 */
        T.k = k; T.x = cx - (cx - drag.tx) / drag.k0 * k + (mx - drag.mx); T.y = cy - (cy - drag.ty) / drag.k0 * k + (my - drag.my);
        applyT(); return;
      }
      if (drag.type === 'none') return;
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < (drag.touch ? 8 : 4)) return;
      drag.moved = true;
      if (drag.type === 'pan') {
        T.x = drag.tx + dx; T.y = drag.ty + dy; svg.classList.add('panning'); applyT();
        drag.hist.push({ x: ev.clientX, y: ev.clientY, t: performance.now() });
        if (drag.hist.length > 5) drag.hist.shift();
      } else {
        const n = nmap.get(drag.id), [wx, wy] = toWorld(ev.clientX, ev.clientY);
        n.fx = n.x = wx; n.fy = n.y = wy;
        reheat(.3); paint();
      }
    });
    const up = ev => {
      if (!ptrs.has(ev.pointerId)) return;
      ptrs.delete(ev.pointerId);
      svg.classList.remove('panning');
      if (!drag) return;
      const d = drag;
      /* 双指松开一只后，剩下那只不再接着平移，免得画面跳一下 */
      if (d.type === 'pinch') { drag = ptrs.size ? { type: 'none' } : null; return; }
      if (ptrs.size) return;
      drag = null;
      if (d.type === 'none') return;
      if (d.type === 'node' && mode === 'all') { const n = nmap.get(d.id); n.fx = null; n.fy = null; }
      if (!d.moved) { if (ev.type === 'pointerup') tap(ev, d.touch); }
      else if (d.type === 'pan' && d.touch) fling(d.hist);
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse' && !drag) { setHover(null); hideTip(); } });
    svg.addEventListener('wheel', ev => {
      ev.preventDefault();
      hideTip();
      const r = svg.getBoundingClientRect();
      const k = Math.max(.2, Math.min(4, T.k * Math.exp(-ev.deltaY * (ev.ctrlKey ? .01 : .0014))));
      const cx = ev.clientX - r.left, cy = ev.clientY - r.top;
      cancelAnimationFrame(anim); cancelAnimationFrame(glide);
      T.x = cx - (cx - T.x) / T.k * k; T.y = cy - (cy - T.y) / T.k * k; T.k = k;
      applyT();
    }, { passive: false });
  }

  function init() {
    resize();
    /* 竖屏（手机全屏）把家族锚点转九十度，整张图竖着摊开，能放得更大 */
    const tall = previewOnly() ? innerHeight > innerWidth : H > W * 1.05;
    anch = tall ? Object.fromEntries(Object.entries(ANCH).map(([g, [x, y]]) => [g, [y * 1.1, x * .95]])) : ANCH;
    build();
    buildControls();
    buildPath();
    bindPointer();
    alpha = 1;
    for (let i = 0; i < 700; i++) step();
    alpha = .02;
    applyFilters();
    renderBar();
    fitVisible(true);
    ready = true;
    new ResizeObserver(() => { const ow = W, oh = H; resize(); if (ready && (Math.abs(ow - W) > 40 || Math.abs(oh - H) > 140)) refit(true); }).observe(stage);
    addEventListener('popstate', () => { if (full) setFull(false, true); });
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape' || ev.defaultPrevented || Tabs.cur !== 'graph') return;
      if (!$('#gFilter').hidden) toggleFilter(false);
      else if (full) setFull(false);
      else if (mode !== 'all') exitModes();
    });
  }
  return { init, resize, select, clearSelection, radial, focus, openPath, exitFull: () => setFull(false), home: () => exitModes() };
})();
