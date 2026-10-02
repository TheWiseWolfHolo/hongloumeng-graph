/* ============ 百二十回 ============ */
const Timeline = (() => {
  let kind = 'all', part = 'all', who = null;

  /* 上面的轴画成一幅手卷：两头是卷轴，开头一段红绫引首，每十回一道界栏。
     前八十回与后四十回是两张纸，接缝上骑着盖一方“续书”印。
     每件大事是一方小印，按神话、家事、情缘、诗社、风波、生死分六行盖在它开始的那一回，跨几回就拉长几栏；
     悬停时那几回铺一层浅色，纸的下方题出回目与事件。 */
  function axis() {
    const svg = $('#tlAxis');
    const W = 1200, T = 12, B = 160, X0 = 140, X1 = 1166, CW = (X1 - X0) / 120;
    const xs = n => X0 + (n - 1) * CW;
    const seam = xs(81), F0 = T + 8, F1 = B - 8;
    const KINDS = Object.keys(EVENT_KINDS), rowY = k => F0 + 18 + KINDS.indexOf(k) * 16;
    [6, W - 22].forEach(x => {
      svgEl('rect', { class: 'tl-cap', x: x + 3, y: T - 9, width: 10, height: B - T + 18, rx: 3 }, svg);
      svgEl('rect', { class: 'tl-rod', x, y: T - 3, width: 16, height: B - T + 6, rx: 4 }, svg);
      svgEl('rect', { class: 'tl-shine', x: x + 4, y: T, width: 2.5, height: B - T, rx: 1 }, svg);
    });
    svgEl('rect', { class: 'tl-yin', x: 22, y: T, width: 70, height: B - T }, svg);
    svgEl('rect', { class: 'tl-yin-in', x: 28, y: T + 6, width: 58, height: B - T - 12 }, svg);
    const yt = svgEl('text', { class: 'tl-yt', x: 57, y: T + 50 }, svg);
    [...'百廿回'].forEach((ch, i) => { svgEl('tspan', { x: 57, dy: i ? '1.12em' : 0 }, yt).textContent = ch; });
    svgEl('rect', { class: 'tl-sheet', x: 92, y: T, width: seam - 92, height: B - T }, svg);
    svgEl('rect', { class: 'tl-sheet late', x: seam, y: T, width: W - 22 - seam, height: B - T }, svg);
    for (let n = 0; n <= 120; n += 10) {
      const x = X0 + n * CW;
      svgEl('line', { class: 'tl-rule', x1: x, x2: x, y1: F0, y2: F1 }, svg);
    }
    KINDS.forEach(k => {
      svgEl('line', { class: 'tl-lane', x1: X0, x2: X1, y1: rowY(k), y2: rowY(k) }, svg);
      const t = svgEl('text', { class: 'tl-kind', x: X0 - 8, y: rowY(k) + 4 }, svg);
      t.style.fill = EVENT_KINDS[k];
      t.textContent = k;
    });
    svgEl('rect', { class: 'tl-frame', x: X0 - 40, y: F0 - 4, width: X1 - X0 + 46, height: F1 - F0 + 8 }, svg);
    svgEl('rect', { class: 'tl-frame in', x: X0 - 36, y: F0, width: X1 - X0 + 38, height: F1 - F0 }, svg);
    svgEl('line', { class: 'tl-seam', x1: seam, x2: seam, y1: T, y2: B }, svg);
    Array.from({ length: 12 }, (_, i) => (i + 1) * 10).forEach(n => {
      svgEl('text', { class: 'tl-num', x: xs(n) + CW / 2, y: B + 18 }, svg).textContent = cnNum(n);
    });
    const read = [
      svgEl('text', { class: 'tl-read', x: (X0 + seam) / 2, y: F1 - 11 }, svg),
      svgEl('text', { class: 'tl-read late', x: (seam + X1) / 2, y: F1 - 11 }, svg)
    ];
    const READ0 = ['前八十回　曹雪芹原著', '后四十回　通常认为出自续书'];
    const say = (k, s) => { read[k].textContent = s || READ0[k]; read[k].classList.toggle('on', !!s); };
    say(0); say(1);
    const rand = (i => () => { i = (i * 9301 + 49297) % 233280; return i / 233280; })(120);
    EVENTS.forEach(e => {
      const x0 = xs(e.c[0]), x1 = xs(e.c[e.c.length - 1]) + CW, y = rowY(e.k), w = x1 - x0 - 2.4, cx = (x0 + x1) / 2;
      const g = svgEl('g', { class: 'tl-dot', 'data-i': e.i, tabindex: 0, role: 'button', 'aria-label': `${chName(e.c)} ${e.t}` }, svg);
      g.style.setProperty('--c', EVENT_KINDS[e.k]);
      svgEl('rect', { class: 'tl-tint', x: x0, y: F0, width: x1 - x0, height: 6 * 16 + 14 }, g);
      /* 手盖的印不会摆得笔直，每方随手歪一点 */
      const tilt = ((rand() - .5) * (e.c.length > 1 ? 4 : 12)).toFixed(1);
      svgEl('rect', { class: 'tl-stamp', x: (x0 + 1.2).toFixed(1), y: y - 5, width: w.toFixed(1), height: 10, rx: 1.4, transform: `rotate(${tilt} ${cx.toFixed(1)} ${y})` }, g);
      svgEl('title', {}, g).textContent = `${chName(e.c)} · ${e.t}`;
    });
    const seal = svgEl('g', { class: 'tl-seal', transform: `rotate(-5 ${seam.toFixed(1)} ${T + 6})` }, svg);
    svgEl('rect', { x: seam - 7.5, y: T - 8, width: 15, height: 28, rx: 1.5 }, seal);
    const st = svgEl('text', { x: seam, y: T + 3 }, seal);
    [...'续书'].forEach((ch, i) => { svgEl('tspan', { x: seam.toFixed(1), dy: i ? '1.1em' : 0 }, st).textContent = ch; });
    const hit = ev => ev.target.closest && ev.target.closest('.tl-dot');
    svg.addEventListener('pointerover', ev => { const g = hit(ev); if (!g) return; const e = EVENTS[+g.dataset.i]; say(e.late ? 1 : 0, `${chName(e.c)}　${e.t}`); });
    svg.addEventListener('pointerout', ev => { const g = hit(ev); if (g && !g.contains(ev.relatedTarget)) { say(0); say(1); } });
    svg.addEventListener('click', ev => { const g = hit(ev); if (g) focus(+g.dataset.i); });
    svg.addEventListener('keydown', ev => { const g = hit(ev); if (g && ev.key === 'Enter') focus(+g.dataset.i); });
  }

  function list() {
    let h = '', sep = false;
    EVENTS.forEach(e => {
      if (e.late && !sep) { h += '<li class="tl-sep" id="tlSep">以下为后四十回，通常认为出自续书，与前八十回的伏笔并不都相合</li>'; sep = true; }
      h += `<li class="tl-i" data-i="${e.i}" style="--c:${EVENT_KINDS[e.k]}">
        <div class="tl-ch">${chName(e.c)}</div>
        <div class="tl-body"><h4>${esc(e.t)}<span class="badge">${e.k}</span></h4><p>${esc(e.d)}</p><div class="mem">${e.ids.map(pill).join('')}</div></div></li>`;
    });
    $('#tlList').innerHTML = h;
  }

  function apply() {
    let n = 0, lateShown = 0;
    const ok = e => (kind === 'all' || e.k === kind) && (part === 'all' || (part === 'late') === e.late) && (!who || e.ids.includes(who));
    $$('#tlList .tl-i').forEach(li => {
      const e = EVENTS[+li.dataset.i], v = ok(e);
      li.hidden = !v;
      if (v) { n++; if (e.late) lateShown++; }
    });
    $('#tlSep').hidden = !lateShown;
    $$('#tlAxis .tl-dot').forEach(g => g.classList.toggle('dim', !ok(EVENTS[+g.dataset.i])));
    $$('#tlKinds .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.k === kind)));
    $$('#segPart button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === part)));
    let s = `共 ${n} 件`;
    if (who) {
      const evs = evOf.get(who);
      s = evs.length
        ? `${who}出现在 ${evs.length} 件大事里，最早是${chName(evs[0].c)}，最后是${chName(evs[evs.length - 1].c)}。`
        : `${who}没有收录在这些大事里。`;
    }
    $('#tlCount').textContent = s;
    $('#tlWhoChip').hidden = !who;
    $('#tlWhoName').textContent = who || '';
    $('#tlEmpty').hidden = n > 0;
  }

  function init() {
    axis();
    list();
    $('#tlKinds').innerHTML = `<button class="chip" type="button" data-k="all" aria-pressed="true">全部</button>`
      + Object.entries(EVENT_KINDS).map(([k, c]) => `<button class="chip" type="button" data-k="${k}" aria-pressed="false"><i class="dot" style="--c:${c}"></i>${k}</button>`).join('');
    $('#tlKinds').addEventListener('click', ev => { const c = ev.target.closest('.chip'); if (!c) return; kind = c.dataset.k; apply(); });
    $('#segPart').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; part = b.dataset.k; apply(); });
    bindSearch($('#tlWho'), $('#tlWhoSug'), id => { who = id; $('#tlWho').value = ''; apply(); });
    $('#tlWhoClear').addEventListener('click', () => { who = null; apply(); });
    apply();
  }

  function focus(i) {
    const e = EVENTS[i];
    if (!e) return;
    if ((kind !== 'all' && kind !== e.k) || (part !== 'all' && (part === 'late') !== e.late) || (who && !e.ids.includes(who))) {
      kind = 'all'; part = 'all'; who = null; apply();
    }
    const li = $(`#tlList .tl-i[data-i="${i}"]`);
    li.scrollIntoView({ block: 'center', behavior: 'smooth' });
    flash(li);
  }
  return { init, focus };
})();
