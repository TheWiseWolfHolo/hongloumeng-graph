/* ============ 百二十回 ============ */
const Timeline = (() => {
  let kind = 'all', part = 'all', who = null;
  const X0 = 40, X1 = 1160;
  const xOf = n => X0 + (n - 1) / 119 * (X1 - X0);

  function axis() {
    const svg = $('#tlAxis');
    const lateX = xOf(80.5);
    svgEl('rect', { class: 'tl-late', x: lateX, y: 20, width: X1 + 14 - lateX, height: 70, rx: 6 }, svg);
    svgEl('text', { class: 'tl-part', x: (X0 + lateX) / 2, y: 14 }, svg).textContent = '前八十回 · 曹雪芹原著';
    svgEl('text', { class: 'tl-part', x: (lateX + X1) / 2, y: 14 }, svg).textContent = '后四十回 · 通常认为是续书';
    svgEl('line', { class: 'tl-base', x1: X0 - 10, x2: X1 + 10, y1: 76, y2: 76 }, svg);
    for (let n = 1; n <= 120; n++) {
      if (n % 5 && n !== 1) continue;
      const big = n % 10 === 0 || n === 1;
      svgEl('line', { class: 'tl-tick', x1: xOf(n), x2: xOf(n), y1: 76, y2: big ? 84 : 80 }, svg);
      if (big) svgEl('text', { class: 'tl-tlab', x: xOf(n), y: 98 }, svg).textContent = n;
    }
    /* 事件点：同一位置附近的往上叠 */
    const lanes = [];
    EVENTS.forEach(e => {
      const x = xOf(e.n);
      let lane = 0;
      while (lanes[lane] != null && x - lanes[lane] < 15) lane++;
      lanes[lane] = x;
      const g = svgEl('g', { class: 'tl-dot', 'data-i': e.i, tabindex: 0, role: 'button', 'aria-label': `${chName(e.c)} ${e.t}` }, svg);
      g.style.setProperty('--c', EVENT_KINDS[e.k]);
      svgEl('circle', { cx: x, cy: 64 - lane * 14, r: 6 }, g);
      svgEl('title', {}, g).textContent = `${chName(e.c)} · ${e.t}`;
    });
    svg.addEventListener('click', ev => { const g = ev.target.closest('.tl-dot'); if (g) focus(+g.dataset.i); });
    svg.addEventListener('keydown', ev => { const g = ev.target.closest('.tl-dot'); if (g && ev.key === 'Enter') focus(+g.dataset.i); });
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
