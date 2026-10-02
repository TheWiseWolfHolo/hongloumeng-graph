/* ============ 四大家族 ============ */
const Families = (() => {
  const HW = 88, HH = 54;
  let selHouse = 'jia', selLink = null, svg;
  function trim(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const s = Math.min(HW / Math.abs(dx || 1e-6), HH / Math.abs(dy || 1e-6)) + .04;
    return [a[0] + dx * s, a[1] + dy * s];
  }
  function init() {
    svg = $('#famSvg');
    HOUSE_LINKS.forEach((l, i) => {
      const p = trim(HOUSES[l.a].pos, HOUSES[l.b].pos), q = trim(HOUSES[l.b].pos, HOUSES[l.a].pos);
      const g = svgEl('g', { 'data-l': i }, svg);
      svgEl('path', { class: 'fm-link', d: `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}` }, g);
      svgEl('text', { class: 'fm-lab', x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2 + 4 }, g).textContent = l.text;
      g.addEventListener('click', () => { selLink = i; render(); });
    });
    Object.entries(HOUSES).forEach(([k, h]) => {
      const g = svgEl('g', { class: 'fm-node', 'data-h': k }, svg);
      g.style.setProperty('--c', `var(--g-${h.grp})`);
      svgEl('rect', { x: h.pos[0] - HW, y: h.pos[1] - HH, width: HW * 2, height: HH * 2, rx: 6 }, g);
      svgEl('text', { class: 'big', x: h.pos[0], y: h.pos[1] + 8 }, g).textContent = h.name;
      svgEl('text', { class: 'sm', x: h.pos[0], y: h.pos[1] + 34 }, g).textContent = h.label;
      g.addEventListener('click', () => { selHouse = k; selLink = null; render(); });
    });
    $('#guan').innerHTML = GUANFU.map((t, i) => `<p data-i="${i}">${esc(t)}</p>`).join('') + '<footer>第四回，门子给贾雨村看的“护官符”。四句各指一家。</footer>';
    render();
  }
  function render() {
    $$('.fm-node', svg).forEach(g => g.classList.toggle('on', g.dataset.h === selHouse && selLink == null));
    $$('[data-l]', svg).forEach(g => $('.fm-link', g).classList.toggle('on', +g.dataset.l === selLink));
    const idx = ['jia', 'shi', 'wang', 'xue'].indexOf(selHouse);
    $$('#guan p').forEach(p => p.classList.toggle('on', +p.dataset.i === idx && selLink == null));
    const el = $('#housePanel');
    if (selLink != null) {
      const l = HOUSE_LINKS[selLink], A = HOUSES[l.a], B = HOUSES[l.b];
      el.innerHTML = `<h3>${A.name} 与 ${B.name} · ${esc(l.text)}</h3><p>${esc(l.note)}</p><div class="mem">${[...new Set([...A.members, ...B.members])].map(pill).join('')}</div>`;
      return;
    }
    const h = HOUSES[selHouse];
    el.innerHTML = `<h3><i class="dot" style="--c:var(--g-${h.grp})"></i>${h.name} · ${esc(h.label)}</h3><p><b class="sans">出身</b>　${esc(h.guan)}</p><p><b class="sans">在书中</b>　${esc(h.now)}</p><div class="mem">${h.members.map(pill).join('')}</div>`;
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
    return `<article class="c12${wide ? ' wide' : ''}" data-ids="${v.ids.join(',')}">
      <div class="vt">${v.verse.map(l => `<span>${esc(l)}</span>`).join('')}</div>
      <div class="rt"><h3>${names}</h3>
      <p class="ln"><b>图</b>${esc(v.pic)}</p>
      ${v.song ? `<p class="ln"><b>曲</b>${esc(v.song)}</p>` : ''}
      ${v.flower ? `<p class="ln"><b>花签</b>${esc(v.flower)}</p>` : ''}
      <p class="gloss">${esc(v.gloss)}</p></div>
      ${fates ? `<div class="fate">${fates}</div>` : ''}</article>`;
  }
  function render() {
    $('#cards12').innerHTML = list().map(card).join('');
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
