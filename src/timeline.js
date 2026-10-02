/* ============ 百二十回 ============ */
const Timeline = (() => {
  let kind = 'all', part = 'all', who = null;

  /* 上面是一张稿纸：一百二十回排成六行，一行二十格，前八十回和后四十回正好在第四、五行之间分开。
     有大事的那一回画一个圆圈，颜色按神话、家事、情缘、诗社、风波、生死；跨几回的，用一根细线串到最后一回。
     悬停时稿纸下方题出回目与事件，点一下跳到下面那件事。 */
  function axis() {
    const box = $('#tlAxis'), at = {};
    EVENTS.forEach(e => { for (let c = e.c[0]; c <= e.c[e.c.length - 1]; c++) at[c] = e; });
    const cell = n => {
      const e = at[n];
      if (!e) return `<span class="tlg-c"><i>${n}</i></span>`;
      const a = e.c[0], b = e.c[e.c.length - 1], pos = a === b ? 'one' : n === a ? 'head' : n === b ? 'tail' : 'mid';
      return `<button class="tlg-c tl-dot ${pos}" type="button" data-i="${e.i}" style="--c:${EVENT_KINDS[e.k]}"`
        + `${n === a ? ` aria-label="${chName(e.c)}，${esc(e.t)}"` : ' tabindex="-1" aria-hidden="true"'}><i>${n}</i></button>`;
    };
    const part = (from, to, side, late) => `<div class="tlg-part${late ? ' late' : ''}"><div class="tlg-side">${side}</div>`
      + `<div class="tlg-cells">${Array.from({ length: to - from + 1 }, (_, k) => cell(from + k)).join('')}</div></div>`;
    box.innerHTML = '<div class="tlg-sheet">'
      + part(1, 80, '<b>前八十回</b><small>曹雪芹原著</small>')
      + part(81, 120, '<b>后四十回</b><span class="tlg-seal">续书</span>', true)
      + '</div><p class="tlg-read" aria-hidden="true"></p>';
    const read = $('.tlg-read', box), READ0 = '一格一回，圆圈是一件大事，跨几回的串在一起；点圆圈跳到下面那件事';
    const say = e => {
      read.textContent = e ? `${chName(e.c)}　${e.t}` : READ0;
      read.classList.toggle('on', !!e);
      $$('.tl-dot.hot', box).forEach(c => c.classList.remove('hot'));
      if (e) $$(`.tl-dot[data-i="${e.i}"]`, box).forEach(c => c.classList.add('hot'));
    };
    say(null);
    const hit = ev => ev.target.closest && ev.target.closest('.tl-dot');
    box.addEventListener('pointerover', ev => { const c = hit(ev); if (c) say(EVENTS[+c.dataset.i]); });
    box.addEventListener('pointerout', ev => { const c = hit(ev); if (c && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest(`.tl-dot[data-i="${c.dataset.i}"]`))) say(null); });
    box.addEventListener('focusin', ev => { const c = hit(ev); if (c) say(EVENTS[+c.dataset.i]); });
    box.addEventListener('focusout', () => say(null));
    box.addEventListener('click', ev => { const c = hit(ev); if (c) focus(+c.dataset.i); });
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
