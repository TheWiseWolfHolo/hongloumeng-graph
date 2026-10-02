/* ============ 百二十回 ============ */
const Timeline = (() => {
  let kind = 'all', part = 'all', who = null;

  /* 上面一页照旧书的圈点来排：一回是纸上一个小墨点，像一行句读；有大事的那一回画一个圈，
     要紧的画双圈，跨几回用一根细线串到最后一回，圈上方竖写两三个字的眉批。
     桌面一行四十回，手机一行二十回，每二十回之间留一段空白。后四十回换一张略深的纸，开头盖一方“续”字印。 */
  const narrow = matchMedia('(max-width: 640px)');
  function axis() {
    const box = $('#tlAxis'), at = {}, per = narrow.matches ? 20 : 40;
    EVENTS.forEach(e => { for (let c = e.c[0]; c <= e.c[e.c.length - 1]; c++) at[c] = e; });
    const cell = n => {
      const e = at[n], num = n % 10 ? '' : `<i class="tlb-n">${cnNum(n)}</i>`;
      if (!e) return `<span class="tlb-c">${num}</span>`;
      const a = e.c[0], b = e.c[e.c.length - 1], pos = a === b ? 'one' : n === a ? 'head' : n === b ? 'tail' : 'mid';
      const lab = n === a ? `<span class="tlb-lab">${e.s}</span>` : '';
      return `<button class="tlb-c tl-dot ${pos}${e.m ? ' major' : ''}" type="button" data-i="${e.i}" style="--c:${EVENT_KINDS[e.k]}"`
        + `${n === a ? ` aria-label="${chName(e.c)}，${esc(e.t)}"` : ' tabindex="-1" aria-hidden="true"'}>${lab}${num}</button>`;
    };
    const rows = (from, to) => {
      let h = '';
      for (let r = from; r <= to; r += per) {
        h += '<div class="tlb-row">';
        for (let s = r; s < r + per; s += 20) h += `<div class="tlb-seg">${Array.from({ length: 20 }, (_, k) => cell(s + k)).join('')}</div>`;
        h += '</div>';
      }
      return h;
    };
    box.innerHTML = '<div class="tlb-sheet">'
      + `<div class="tlb-part"><div class="tlb-side"><b>前八十回</b><small>曹雪芹原著</small></div><div class="tlb-rows">${rows(1, 80)}</div></div>`
      + `<div class="tlb-part late"><div class="tlb-side"><b>后四十回</b></div><div class="tlb-rows"><span class="tlb-seal" title="后四十回通常认为出自续书">续</span>`
      + `<p class="tlb-tiji" aria-hidden="true">好一似食尽鸟投林，<br>落了片白茫茫大地真干净。<small>第五回　飞鸟各投林</small></p>${rows(81, 120)}</div></div>`
      + '</div><p class="tlb-read" aria-hidden="true"></p>';
    const read = $('.tlb-read', box), READ0 = '一点一回；圈是大事，双圈更要紧，跨几回的用细线串起。点圈跳到下面那件事';
    const say = e => {
      read.textContent = e ? `${chName(e.c)}　${e.t}` : READ0;
      read.classList.toggle('on', !!e);
      $$('.tl-dot.hot', box).forEach(c => c.classList.remove('hot'));
      if (e) $$(`.tl-dot[data-i="${e.i}"]`, box).forEach(c => c.classList.add('hot'));
    };
    say(null);
    if (box.dataset.bound) return;
    box.dataset.bound = 1;
    const hit = ev => ev.target.closest && ev.target.closest('.tl-dot');
    const same = (c, el) => el && el.closest && el.closest(`.tl-dot[data-i="${c.dataset.i}"]`);
    const sayOf = c => { const p = $('.tlb-read', box); p.textContent = `${chName(EVENTS[+c.dataset.i].c)}　${EVENTS[+c.dataset.i].t}`; p.classList.add('on');
      $$('.tl-dot.hot', box).forEach(x => x.classList.remove('hot')); $$(`.tl-dot[data-i="${c.dataset.i}"]`, box).forEach(x => x.classList.add('hot')); };
    const clear = () => { const p = $('.tlb-read', box); p.textContent = READ0; p.classList.remove('on'); $$('.tl-dot.hot', box).forEach(x => x.classList.remove('hot')); };
    box.addEventListener('pointerover', ev => { const c = hit(ev); if (c) sayOf(c); });
    box.addEventListener('pointerout', ev => { const c = hit(ev); if (c && !same(c, ev.relatedTarget)) clear(); });
    box.addEventListener('focusin', ev => { const c = hit(ev); if (c) sayOf(c); });
    box.addEventListener('focusout', clear);
    box.addEventListener('click', ev => { const c = hit(ev); if (c) focus(+c.dataset.i); });
    /* 跨过手机与桌面的宽度时，一行的回数要变，重排一遍再套上筛选 */
    narrow.addEventListener('change', () => { axis(); apply(); });
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
