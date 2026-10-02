/* ============ 四大家族 ============ */
/* 左边是第四回门子递给雨村的那张护官符：四句竖写，句旁是原书小注，选中哪家就在那一句旁加圈点。
   右边是五家的印：四大家族用白文印，不在护官符上的林家用朱文印；箭头从娘家指向夫家，线上写嫁过去的人。 */
const Families = (() => {
  const ORDER = ['jia', 'shi', 'wang', 'xue'];
  let selHouse = 'jia', selLink = null, svg;
  const half = k => k === 'jia' ? 50 : 34;
  /* 从 a 印的边上出发，到 b 印的边上为止 */
  function edge(a, b, k) {
    const dx = b[0] - a[0], dy = b[1] - a[1], h = half(k) + 6;
    const s = Math.min(h / Math.abs(dx || 1e-6), h / Math.abs(dy || 1e-6));
    return [a[0] + dx * s, a[1] + dy * s];
  }
  function link(l, i) {
    const A = HOUSES[l.a].pos, B = HOUSES[l.b].pos;
    const p = edge(A, B, l.a), q = edge(B, A, l.b);
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy);
    const bend = l.a === 'wang' && l.b === 'xue' ? -44 : 22;
    const c = [mx - dy / d * bend, my + dx / d * bend];
    const g = svgEl('g', { class: 'fm-l' + (l.late ? ' late' : ''), 'data-l': i, tabindex: 0, role: 'button', 'aria-label': `${l.who.join('、')}从${HOUSES[l.a].name}家嫁到${HOUSES[l.b].name}家` }, svg);
    svgEl('path', { class: 'fm-hit', d: `M${p}Q${c} ${q}` }, g);
    svgEl('path', { class: 'fm-link', d: `M${p}Q${c} ${q}` }, g);
    const tx = q[0] - c[0], ty = q[1] - c[1], tl = Math.hypot(tx, ty), ux = tx / tl, uy = ty / tl;
    svgEl('path', { class: 'fm-arrow', d: `M${q[0]} ${q[1]}L${q[0] - ux * 11 - uy * 5} ${q[1] - uy * 11 + ux * 5}L${q[0] - ux * 11 + uy * 5} ${q[1] - uy * 11 - ux * 5}Z` }, g);
    const lx = .25 * p[0] + .5 * c[0] + .25 * q[0], ly = .25 * p[1] + .5 * c[1] + .25 * q[1];
    svgEl('text', { class: 'fm-lab', x: lx.toFixed(1), y: (ly + 5).toFixed(1) }, g).textContent = l.who.join('、') + (l.late ? '（续书）' : '');
  }
  function seal(k) {
    const h = HOUSES[k], r = half(k), [x, y] = h.pos;
    const g = svgEl('g', { class: 'fm-node' + (k === 'lin' ? ' zhu' : ''), 'data-h': k, tabindex: 0, role: 'button', 'aria-label': `${h.name}家` }, svg);
    g.style.setProperty('--c', `var(--g-${h.grp})`);
    svgEl('rect', { class: 'ring', x: x - r - 6, y: y - r - 6, width: 2 * r + 12, height: 2 * r + 12, rx: 8 }, g);
    svgEl('rect', { class: 'body', x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: 5 }, g);
    svgEl('rect', { class: 'inner', x: x - r + 5, y: y - r + 5, width: 2 * r - 10, height: 2 * r - 10, rx: 3 }, g);
    svgEl('text', { class: 'big', x, y: y + r * .36, 'font-size': r * 1.2 }, g).textContent = h.name;
    svgEl('text', { class: 'sm', x, y: y < 150 ? y - r - 15 : y + r + 24 }, g).textContent = h.label;
  }
  function init() {
    svg = $('#famSvg');
    HOUSE_LINKS.forEach(link);
    Object.keys(HOUSES).forEach(seal);
    svg.addEventListener('click', ev => {
      const n = ev.target.closest('.fm-node'), l = ev.target.closest('.fm-l');
      if (n) { selHouse = n.dataset.h; selLink = null; render(); }
      else if (l) { selLink = +l.dataset.l; render(); }
    });
    svg.addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    $('#guan').innerHTML = `<div class="hgf-t"><b>护官符</b><small>第四回</small></div>`
      + ORDER.map((k, i) => `<div class="hgf-col" role="button" tabindex="0" data-h="${k}" style="--c:var(--g-${HOUSES[k].grp})">
        <p class="hgf-m"><i class="hgf-seal">${HOUSES[k].name}</i>${esc(GUANFU[i])}</p><p class="hgf-n">${esc(HOUSES[k].note)}</p></div>`).join('')
      + `<p class="hgf-end">门子从顺袋中取出一张抄写的护官符来，递与雨村</p>`;
    $('#guan').addEventListener('click', ev => { const c = ev.target.closest('.hgf-col'); if (c) { selHouse = c.dataset.h; selLink = null; render(); } });
    $('#guan').addEventListener('keydown', ev => { const c = ev.target.closest('.hgf-col'); if (c && ev.key === 'Enter') { selHouse = c.dataset.h; selLink = null; render(); } });
    render();
  }
  function fang(h) {
    if (!h.fang) return `<dt>房分</dt><dd>${esc(h.few)}</dd>`;
    const [all, du] = h.fang;
    const box = Array.from({ length: all }, (_, i) => `<i${du && i < du ? ' class="du"' : ''}></i>`).join('');
    const say = du ? `共${cnNum(all)}房，在京${cnNum(du)}房，原籍${cnNum(all - du)}房` : `共${cnNum(all)}房`;
    return `<dt>房分</dt><dd><span class="fang">${box}</span><span class="fang-t">${say}</span></dd>`;
  }
  function render() {
    $$('.fm-node', svg).forEach(g => g.classList.toggle('on', g.dataset.h === selHouse && selLink == null));
    $$('.fm-l', svg).forEach(g => g.classList.toggle('on', +g.dataset.l === selLink));
    $$('#guan .hgf-col').forEach(c => c.classList.toggle('on', c.dataset.h === selHouse && selLink == null));
    const el = $('#housePanel');
    const mark = k => `<span class="hp-seal${k === 'lin' ? ' zhu' : ''}" style="--c:var(--g-${HOUSES[k].grp})">${HOUSES[k].name}</span>`;
    if (selLink != null) {
      const l = HOUSE_LINKS[selLink], A = HOUSES[l.a], B = HOUSES[l.b];
      el.style.setProperty('--c', `var(--g-${B.grp})`);
      el.innerHTML = `<div class="hp-head">${mark(l.a)}<span class="hp-to">嫁入</span>${mark(l.b)}<div><h3>${esc(l.text)}</h3><p class="hp-k">${A.name}家的女儿嫁进${B.name}家${l.late ? '（续书）' : ''}</p></div></div>
        <p class="hp-p">${esc(l.note)}</p><div class="mem">${[...new Set([...l.who, ...A.members, ...B.members])].map(pill).join('')}</div>`;
      return;
    }
    const h = HOUSES[selHouse], i = ORDER.indexOf(selHouse);
    el.style.setProperty('--c', `var(--g-${h.grp})`);
    el.innerHTML = `<div class="hp-head">${mark(selHouse)}<div><h3>${h.name}家 · ${esc(h.label)}</h3><p class="hp-k">${i < 0 ? '不在护官符上' : '护官符第' + cnNum(i + 1) + '句'}</p></div></div>
      <dl class="hp-dl"><dt>出身</dt><dd>${esc(h.guan)}</dd><dt>在书中</dt><dd>${esc(h.now)}</dd>${fang(h)}</dl>
      <div class="mem">${h.members.map(pill).join('')}</div>`;
  }
  return { init };
})();

/* ============ 金陵十二钗 ============ */
const Twelve = (() => {
  let book = 'z';
  const SONGS = ['红楼梦引子', '终身误', '枉凝眉', '恨无常', '分骨肉', '乐中悲', '世难容', '喜冤家', '虚花悟', '聪明累', '留余庆', '晚韶华', '好事终', '飞鸟各投林'];
  const list = () => book === 'z' ? TWELVE : TWELVE_MORE.filter(v => v.book === (book === 'f' ? '副册' : '又副册'));
  function card(v) {
    const wide = v.verse.length > 4 || v.ids.length > 1;
    const names = v.ids.map(id => `<button type="button" data-pick="${esc(id)}" style="--c:var(--g-${byId.get(id).grp})">${esc(id)}</button>`).join('<span class="sans and">与</span>');
    const fates = v.ids.filter(id => byId.get(id).fate).map(id => `<b class="sans">${esc(id)}</b>　${esc(byId.get(id).fate)}`).join('<br>');
    const pics = v.ids.filter(id => PORTRAITS[id]);
    const fig = pics.length ? `<div class="c12-pics">${pics.map(id => `<button class="c12-pic" type="button" data-zoom="${portrait(id)}" aria-label="${esc(id)}画像"><img src="${portrait(id)}" alt="" loading="lazy" decoding="async" width="640" height="960"></button>`).join('')}</div>` : '';
    return `<article class="c12${wide ? ' wide' : ''}${pics.length ? ' has-pic' : ''}" data-ids="${v.ids.join(',')}">
      ${fig}<div class="vt">${v.verse.map(l => `<span>${esc(l)}</span>`).join('')}</div>
      <div class="rt"><h3>${names}</h3>
      <p class="ln"><b>图</b>${esc(v.pic)}</p>
      ${v.song ? `<p class="ln"><b>曲</b>${esc(v.song)}</p>` : ''}
      ${v.flower ? `<p class="ln"><b>花签</b>${esc(v.flower)}</p>` : ''}
      <p class="gloss">${esc(v.gloss)}</p></div>
      ${fates ? `<div class="fate">${fates}</div>` : ''}</article>`;
  }
  function render() {
    $('#cards12').innerHTML = list().map(card).join('');
    $('#cards12').classList.toggle('pics', book === 'z');
    $$('#segBook button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === book)));
  }
  function init() {
    $('#segBook').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; book = b.dataset.k; render(); });
    $('#songBar').innerHTML = `<b>红楼梦十二支曲</b><span>${SONGS.map(s => `《${s}》`).join('')}</span>`;
    render();
  }
  function focus(id) {
    const v = verseOf(id);
    if (!v) return;
    book = TWELVE.includes(v) ? 'z' : (v.book === '副册' ? 'f' : 'y');
    render();
    const el = $$('.c12').find(c => c.dataset.ids.split(',').includes(id));
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); flash(el); }
  }
  return { init, focus };
})();

function flash(el) {
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

/* ============ 情缘与风波 ============ */
const Love = (() => {
  /* 上半部分的图与文字写在 body.html 里，这里只补人物按钮 */
  const ENDS = { 悲: '悲剧', 喜: '圆满', 另: '另说' };
  let filter = 'all';
  function renderCards() {
    $$('#lovGrid .lov').forEach(e => { e.hidden = filter !== 'all' && e.dataset.end !== filter; });
    $$('#segLove button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === filter)));
  }
  function init() {
    $$('#duet [data-ids]').forEach(el => { el.innerHTML = el.dataset.ids.split(',').map(pill).join(''); });
    const n = k => LOVES.filter(l => l.end === k).length;
    $('#segLove').innerHTML = `<button type="button" data-k="all" aria-pressed="true">全部 <small>${LOVES.length}</small></button>`
      + Object.entries(ENDS).map(([k, v]) => `<button type="button" data-k="${k}" aria-pressed="false">${v} <small>${n(k)}</small></button>`).join('');
    $('#lovGrid').innerHTML = LOVES.map(l => `<article class="lov" data-end="${l.end}">
      <span class="lov-seal">${ENDS[l.end]}</span>
      <p class="lov-k">${esc(l.kind)}</p>
      <h4>${esc(l.title)}</h4>
      <p class="lov-t">${esc(l.text)}</p>
      <p class="out"><b>结局</b>${esc(l.out)}</p>
      <div class="mem">${l.ids.map(pill).join('')}</div></article>`).join('');
    renderCards();
    $('#segLove').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; filter = b.dataset.k; renderCards(); });
    $('#feuds').innerHTML = FEUDS.map(f => `<li class="fe">
      <p class="fe-hui"><small>${esc(f.ch)}</small><span>${esc(f.hui)}</span></p>
      <div class="fe-b"><h4>${esc(f.title)}</h4><p>${esc(f.text)}</p><div class="mem">${f.ids.map(pill).join('')}</div></div></li>`).join('');
  }
  return { init };
})();

/* ============ 人物谱 ============ */
const PeopleIndex = (() => {
  let grp = 'all', q = '';
  const ORDER = Object.keys(GROUPS);
  const BOOK = { z: '正册', f: '副册', y: '又副册' };
  function init() {
    $('#idxChips').innerHTML = `<button class="chip" type="button" data-k="all" aria-pressed="true">全部 ${PEOPLE.length}</button><button class="chip" type="button" data-k="tag" aria-pressed="false">金陵十二钗及副册</button>`
      + ORDER.map(k => `<button class="chip" type="button" data-k="${k}" aria-pressed="false"><i class="dot" style="--c:var(--g-${k})"></i>${GROUPS[k].name}</button>`).join('');
    const sorted = [...PEOPLE].sort((a, b) => ORDER.indexOf(a.grp) - ORDER.indexOf(b.grp) || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
    $('#idxGrid').innerHTML = sorted.map(p => {
      const ev = evOf.get(p.id).length;
      return `<button class="pc" type="button" data-pick="${esc(p.id)}" style="--c:var(--g-${p.grp})"><span class="n">${esc(p.id)}</span><span class="s">${esc(p.sub)}</span><span class="m">${GROUPS[p.grp].name} · ${adj.get(p.id).length} 条关系${ev ? ` · ${ev} 件大事` : ''}${p.tag ? `<span class="z">${BOOK[p.tag]}</span>` : ''}</span></button>`;
    }).join('');
    $('#idxChips').addEventListener('click', ev => { const c = ev.target.closest('.chip'); if (!c) return; grp = c.dataset.k; $$('#idxChips .chip').forEach(x => x.setAttribute('aria-pressed', String(x === c))); apply(); });
    $('#idxQ').addEventListener('input', ev => { q = ev.target.value.trim(); apply(); });
    apply();
  }
  function apply() {
    let n = 0;
    $$('#idxGrid .pc').forEach(el => {
      const p = byId.get(el.dataset.pick);
      const ok = (grp === 'all' || (grp === 'tag' ? !!p.tag : p.grp === grp)) && (!q || p.id.includes(q) || p.sub.includes(q) || p.bio.includes(q));
      el.hidden = !ok; if (ok) n++;
    });
    $('#idxCount').textContent = `共 ${n} 位`;
  }
  return { init };
})();
