/* ============ 贾府世系 ============ */
const Tree = (() => {
  const BW = 94, BH = 50, SG = 10, CG = 20, RH = 150, TOP = 70, LEFT = 30;
  let scale = .85, totalW = 0, totalH = 0, rongLeft = 0, svg, box, labels, posOf = {};
  /* 字辈列是独立的冻结列,树从它右边开始;可视区的宽度要扣掉这一列 */
  const colW = () => labels.offsetWidth;
  const viewW = () => box.clientWidth - colW();

  function measure(t) {
    const k = (t.sp || []).length, ch = t.ch || [];
    t.uw = (k + 1) * BW + k * SG;
    ch.forEach(measure);
    t.kw = ch.reduce((s, c) => s + c.w, 0) + CG * Math.max(0, ch.length - 1);
    t.w = Math.max(t.uw, t.kw);
  }
  function place(t, left, d) {
    t.d = d; t.ux = left + (t.w - t.uw) / 2; t.y = TOP + d * RH;
    let x = left + (t.w - t.kw) / 2;
    (t.ch || []).forEach(c => { place(c, x, d + 1); x += c.w + CG; });
  }
  function walk(t, fn) { fn(t); (t.ch || []).forEach(c => walk(c, fn)); }

  function drawBox(g, x, y, name, sub, grp, gender, opts = {}) {
    const n = svgEl('g', { class: 'tn' + (opts.ghost ? ' ghost' : '') + (opts.x ? ' xx' : ''), 'data-n': name }, g);
    n.style.setProperty('--c', `var(--g-${grp})`);
    svgEl('rect', { x, y, width: BW, height: BH, rx: gender === 'f' ? 25 : 5 }, n);
    svgEl('text', { class: 'nm', x: x + BW / 2, y: y + (sub ? 22 : 30) }, n).textContent = name;
    if (sub) svgEl('text', { class: 'sb', x: x + BW / 2, y: y + 38 }, n).textContent = sub;
    (posOf[name] = posOf[name] || []).push({ x: x + BW / 2, y: y + BH / 2, el: n });
  }

  function init() {
    box = $('#treeBox');
    box.innerHTML = '<div class="tscroll"><div class="tlabels" aria-hidden="true"></div></div>';
    const scroller = $('.tscroll', box);
    labels = $('.tlabels', box);
    const ning = TREE_NING, rong = TREE_RONG;
    measure(ning); measure(rong);
    place(ning, LEFT, 0);
    const rl = LEFT + ning.w + 90;
    rongLeft = rl;
    place(rong, rl, 0);
    totalW = rl + rong.w + 50;
    let maxD = 0;
    [ning, rong].forEach(r => walk(r, t => { maxD = Math.max(maxD, t.d); }));
    totalH = TOP + maxD * RH + BH + 50;
    svg = svgEl('svg', { id: 'tsvg', viewBox: `0 0 ${totalW} ${totalH}`, role: 'img', 'aria-label': '宁荣二府世系图' });
    scroller.appendChild(svg);

    /* 字辈说明放在左侧冻结列里,横向滚动时一直看得见,也不会压住树 */
    GENERATIONS.forEach((g, i) => svgEl('rect', { class: 'gen-band', x: 0, y: TOP + i * RH - 28, width: totalW, height: BH + 56, rx: 6 }, svg));
    labels.innerHTML = GENERATIONS.map(g => `<div class="tlab"><b>${g.label}</b><span>${g.note}</span></div>`).join('');

    const gl = svgEl('g', {}, svg), gb = svgEl('g', {}, svg);
    [ning, rong].forEach(r => walk(r, t => {
      (t.ch || []).forEach(c => {
        const px = t.ux + t.uw / 2, py = t.y + BH, cx = c.ux + BW / 2, mid = py + (RH - BH) / 2;
        svgEl('path', { class: 't-link', d: `M${px} ${py}V${mid}H${cx}V${c.y}` }, gl);
      });
      (t.sp || []).forEach((s, i) => {
        const x1 = t.ux + i * (BW + SG) + BW, y = t.y + BH / 2;
        if (s.t === 'w') svgEl('path', { class: 't-link t-sp', d: `M${x1} ${y - 3}H${x1 + SG}M${x1} ${y + 3}H${x1 + SG}`, stroke: 'var(--gold2)' }, gl);
        else svgEl('path', { class: 't-link', d: `M${x1} ${y}H${x1 + SG}`, 'stroke-dasharray': '3 2', stroke: s.t === 'l' ? 'var(--e-lv)' : 'var(--ink3)', 'stroke-width': 2.4 }, gl);
      });
    }));
    const y0 = TOP + BH / 2;
    svgEl('path', { class: 't-link', d: `M${ning.ux + BW} ${y0}H${rong.ux}`, 'stroke-dasharray': '6 5', stroke: 'var(--gold2)', 'stroke-width': 2.4 }, gl);
    svgEl('text', { class: 'gen-note', x: (ning.ux + BW + rong.ux) / 2, y: y0 - 8, 'text-anchor': 'middle' }, gl).textContent = '宁荣二公,同胞兄弟';

    [ning, rong].forEach(r => walk(r, t => {
      drawBox(gb, t.ux, t.y, t.n, t.s, t.grp, t.g, { x: t.x });
      (t.sp || []).forEach((s, i) => drawBox(gb, t.ux + (i + 1) * (BW + SG), t.y, s.n, s.s, s.grp, s.g, { ghost: s.t === 'l' }));
    }));
    $$('.tn', svg).forEach(n => {
      n.addEventListener('click', () => { if (!n.classList.contains('xx')) pickPerson(n.dataset.n); });
      n.addEventListener('pointerenter', () => (posOf[n.dataset.n] || []).forEach(p => p.el.classList.add('hl')));
      n.addEventListener('pointerleave', () => $$('.tn.hl', svg).forEach(e => e.classList.remove('hl')));
    });
    apply();
    box.scrollLeft = Math.max(0, posOf['贾宝玉'][0].x * scale - viewW() / 2);

    const zoom = f => {
      const mid = (box.scrollLeft + viewW() / 2) / scale;
      scale = Math.max(.4, Math.min(1.6, f(scale)));
      apply();
      box.scrollLeft = mid * scale - viewW() / 2;
    };
    $('#tJumpNing').addEventListener('click', () => box.scrollTo({ left: 0, behavior: 'smooth' }));
    $('#tJumpRong').addEventListener('click', () => box.scrollTo({ left: Math.max(0, rongLeft * scale - 12), behavior: 'smooth' }));
    $('#tZoomIn').addEventListener('click', () => zoom(s => s + .15));
    $('#tZoomOut').addEventListener('click', () => zoom(s => s - .15));
    $('#tFit').addEventListener('click', () => { scale = Math.max(.3, Math.min(1.2, (viewW() - 4) / totalW)); apply(); box.scrollLeft = 0; });
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
    $$('.tlab', labels).forEach((el, i) => { el.style.top = Math.round((TOP + i * RH + BH / 2) * scale - el.offsetHeight / 2) + 'px'; });
  }
  return { init };
})();
