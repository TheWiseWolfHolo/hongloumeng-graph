/* ============ 贾府世系 ============ */
const Tree = (() => {
  /* 照旧时族谱的吊线图来画：名字竖写，从上一代名下垂一根细线，横过一道，再分垂到每个孩子头上的小圆点。
     配偶竖写在本人右边，头上标“配”“妾”“缘”，女儿的丈夫标“适”；女儿本人头上标“女”。名字右边的小字是夹注。
     欧阳修定的谱例是五世一图，这里水、代、文、玉、草正好五辈。 */
  const MW = 24, NW = 15, SG = 12, SW = 20, CG = 22, RH = 150, TOP = 74, LEFT = 30, GAP = 70;
  const NF = 19, NS = 22.5, SF = 16, SS = 19.5, TS = 13, LS = 12;
  let scale = 1, totalW = 0, totalH = 0, rongLeft = 0, svg, box, labels, posOf = {};
  /* 字辈说明是独立的冻结列，树从它右边开始；可视区的宽度要扣掉这一列 */
  const colW = () => labels.offsetWidth;
  const viewW = () => box.clientWidth - colW();
  const fitScale = () => Math.min(1.15, (viewW() - 8) / totalW);
  /* 夹注里“正室”“妾”和头上的标字重复，就不再写 */
  const spNote = s => (s.s && s.s !== '正室' && s.s !== '妾') ? s.s : '';
  const spLab = (t, s) => s.k || (s.t === 'c' ? '妾' : s.t === 'l' ? '缘' : t.g === 'f' ? '适' : '配');
  const spW = s => SG + SW + (spNote(s) ? NW : 0);

  function measure(t) {
    t.uw = MW + (t.s ? NW : 0) + (t.sp || []).reduce((a, s) => a + spW(s), 0);
    const ch = t.ch || [];
    ch.forEach(measure);
    t.kw = ch.reduce((a, c) => a + c.w, 0) + CG * Math.max(0, ch.length - 1);
    t.w = Math.max(t.uw, t.kw);
  }
  function place(t, left, d) {
    t.d = d; t.ux = left + (t.w - t.uw) / 2; t.y = TOP + d * RH; t.mx = t.ux + MW / 2;
    let x = left + (t.w - t.kw) / 2;
    (t.ch || []).forEach(c => { place(c, x, d + 1); x += c.w + CG; });
  }
  function walk(t, fn) { fn(t); (t.ch || []).forEach(c => walk(c, fn)); }

  /* 一个人是一列：头上一个小圆点，下面是标字、竖写的名字，右边夹注。返回名字最后一个字的下沿 */
  function column(g, x, y, name, o) {
    const big = !o.sp, f = big ? NF : SF, step = big ? NS : SS;
    const n = svgEl('g', { class: 'tn' + (o.sp ? ' sp' : '') + (o.ghost ? ' ghost' : '') + (o.xx ? ' xx' : ''), 'data-n': name }, g);
    if (!o.xx) { n.dataset.pick = name; n.setAttribute('tabindex', 0); n.setAttribute('role', 'button'); n.setAttribute('aria-label', name); }
    n.style.setProperty('--c', `var(--g-${o.grp})`);
    const lab = o.lab ? [...o.lab] : [], chars = [...name], notes = o.note ? [...o.note] : [];
    const y0 = y + 18 + (lab.length ? 6 + lab.length * LS : 0);
    const yEnd = y0 + (chars.length - 1) * step + f / 2;
    const nx = x + f / 2 + 7, bottom = Math.max(yEnd, y0 - f / 2 + notes.length * TS);
    svgEl('rect', { class: 'tn-bg', x: x - f / 2 - 5, y: y - 9, width: f + 10 + (notes.length ? NW - 2 : 0), height: bottom - y + 16, rx: (f + 10) / 2 }, n);
    svgEl('circle', { class: 'tn-dot', cx: x, cy: y, r: big ? 4.4 : 3.8 }, n);
    if (lab.length) {
      const lt = svgEl('text', { class: 'tn-lab' }, n);
      lab.forEach((c, i) => { svgEl('tspan', { x, y: (y + 15 + i * LS).toFixed(1) }, lt).textContent = c; });
    }
    const t = svgEl('text', { class: 'nm' }, n);
    chars.forEach((c, i) => { svgEl('tspan', { x, y: (y0 + i * step).toFixed(1) }, t).textContent = c; });
    if (notes.length) {
      const nt = svgEl('text', { class: 'sb' }, n);
      notes.forEach((c, i) => { svgEl('tspan', { x: nx.toFixed(1), y: (y0 - f / 2 + TS / 2 + i * TS).toFixed(1) }, nt).textContent = c; });
    }
    n.__x = x;
    (posOf[name] = posOf[name] || []).push(n);
    return yEnd;
  }

  function init() {
    box = $('#treeBox');
    box.innerHTML = '<div class="tscroll"><div class="tlabels" aria-hidden="true"></div></div>';
    const scroller = $('.tscroll', box);
    labels = $('.tlabels', box);
    const ning = TREE_NING, rong = TREE_RONG;
    measure(ning); measure(rong);
    place(ning, LEFT, 0);
    rongLeft = LEFT + ning.w + GAP;
    place(rong, rongLeft, 0);
    totalW = rongLeft + rong.w + LEFT;
    let maxD = 0;
    [ning, rong].forEach(r => walk(r, t => { maxD = Math.max(maxD, t.d); }));
    totalH = TOP + maxD * RH + 128;
    svg = svgEl('svg', { id: 'tsvg', viewBox: `0 0 ${totalW} ${totalH}`, role: 'img', 'aria-label': '宁荣二府世系图' });
    scroller.appendChild(svg);

    /* 每一辈是一道浅浅的横格，上下两辈之间留一道空，吊线的横杠就走在这道空里 */
    GENERATIONS.forEach((g, i) => svgEl('rect', { class: 'gen-band', x: 0, y: TOP + i * RH - 26, width: totalW, height: RH - 24 }, svg));
    labels.innerHTML = GENERATIONS.map(g => `<div class="tlab"><i>${g.nth}</i><b>${g.ch}</b><span>${g.note}</span></div>`).join('');

    const gl = svgEl('g', {}, svg), gb = svgEl('g', {}, svg);
    [[ning, '宁国府', 'ning'], [rong, '荣国府', 'rong']].forEach(([r, name, grp]) => {
      const h = svgEl('text', { class: 'tr-house', x: r.mx + 6, y: TOP - 44 }, gl);
      h.style.setProperty('--c', `var(--g-${grp})`);
      h.textContent = name;
    });
    svgEl('path', { class: 't-tie bro', d: `M${ning.mx + 8} ${TOP}H${rong.mx - 8}` }, gl);
    svgEl('text', { class: 'gen-note', x: (ning.mx + rong.mx) / 2, y: TOP - 9 }, gl).textContent = '宁荣二公，同胞兄弟';

    [ning, rong].forEach(r => walk(r, t => {
      t.yEnd = column(gb, t.mx, t.y, t.n, { grp: t.grp, note: t.s, lab: t.g === 'f' && t.d ? '女' : '', xx: t.x });
      let cur = t.ux + MW + (t.s ? NW : 0), px = t.mx;
      (t.sp || []).forEach(s => {
        const sx = cur + SG + SW / 2;
        column(gb, sx, t.y, s.n, { sp: true, grp: s.grp, note: spNote(s), lab: spLab(t, s), ghost: s.t === 'l' });
        const a = px + 7, b = sx - 6;
        if (s.t === 'w') svgEl('path', { class: 't-tie w', d: `M${a} ${t.y - 1.8}H${b}M${a} ${t.y + 1.8}H${b}` }, gl);
        else svgEl('path', { class: 't-tie ' + s.t, d: `M${a} ${t.y}H${b}` }, gl);
        px = sx; cur += spW(s);
      });
    }));
    [ning, rong].forEach(r => walk(r, t => {
      const ch = t.ch || [];
      if (!ch.length) return;
      const ry = t.y + RH - 30, xs = ch.map(c => c.mx).concat(t.mx);
      let d = `M${t.mx} ${(t.yEnd + 9).toFixed(1)}V${ry}M${Math.min(...xs)} ${ry}H${Math.max(...xs)}`;
      ch.forEach(c => { d += `M${c.mx} ${ry}V${c.y - 6}`; });
      svgEl('path', { class: 't-link', d }, gl);
    }));

    $$('.tn', svg).forEach(n => {
      n.addEventListener('pointerenter', () => (posOf[n.dataset.n] || []).forEach(el => el.classList.add('hl')));
      n.addEventListener('pointerleave', () => $$('.tn.hl', svg).forEach(e => e.classList.remove('hl')));
    });
    svg.addEventListener('keydown', ev => {
      const n = ev.target.closest && ev.target.closest('.tn[data-pick]');
      if (n && ev.key === 'Enter') pickPerson(n.dataset.pick);
    });

    /* 桌面上整幅放得下就整幅显示；手机上放不下，按可读的大小显示，先停在宝玉那一带 */
    const f = fitScale();
    scale = f >= .78 ? f : .8;
    apply();
    if (f < .78) box.scrollLeft = Math.max(0, posOf['贾宝玉'][0].__x * scale - viewW() / 2);

    const zoom = fn => {
      const mid = (box.scrollLeft + viewW() / 2) / scale;
      scale = Math.max(.4, Math.min(1.6, fn(scale)));
      apply();
      box.scrollLeft = mid * scale - viewW() / 2;
    };
    $('#tJumpNing').addEventListener('click', () => box.scrollTo({ left: 0, behavior: 'smooth' }));
    $('#tJumpRong').addEventListener('click', () => box.scrollTo({ left: Math.max(0, rongLeft * scale - 12), behavior: 'smooth' }));
    $('#tZoomIn').addEventListener('click', () => zoom(s => s + .15));
    $('#tZoomOut').addEventListener('click', () => zoom(s => s - .15));
    $('#tFit').addEventListener('click', () => { scale = Math.max(.3, fitScale()); apply(); box.scrollLeft = 0; });
    let down = null;
    box.addEventListener('pointerdown', ev => {
      if (ev.pointerType !== 'mouse' || ev.target.closest('.tn')) return;
      down = { x: ev.clientX, y: ev.clientY, l: box.scrollLeft, t: box.scrollTop };
      box.setPointerCapture(ev.pointerId); box.style.cursor = 'grabbing';
    });
    box.addEventListener('pointermove', ev => { if (!down) return; box.scrollLeft = down.l - (ev.clientX - down.x); box.scrollTop = down.t - (ev.clientY - down.y); });
    const end = () => { down = null; box.style.cursor = ''; };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }
  function apply() {
    svg.setAttribute('width', Math.round(totalW * scale));
    svg.setAttribute('height', Math.round(totalH * scale));
    labels.style.height = Math.round(totalH * scale) + 'px';
    $$('.tlab', labels).forEach((el, i) => { el.style.top = Math.round((TOP + i * RH + 37) * scale - el.offsetHeight / 2) + 'px'; });
  }
  return { init };
})();
