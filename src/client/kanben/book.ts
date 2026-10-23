/* 首页那本线装书的控制：开在哪一回、随手翻、手拖书角翻页。
   书从左往右翻：往后翻是左页翻到右边，往前翻是右页翻回左边。读过的叶子摞在右边，没读的在左边。
   看见书时只取当前回，点翻页或拖动书角后再取需要的书页。 */
import { geom, drawPage, drawEdge, sizeCanvas, loadFiber, textOf, type Spread, type Side, type Geom } from './page.ts';
import { Curl, type Leaf } from './curl.ts';

type BookChapter = { n: number; label: string };
const bookLimit = () => Number(document.documentElement.dataset.progress) || 120;

export function initialBookChapter(saved: number | null, limit: number, now = new Date()): BookChapter {
  const day = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 864e5);
  const n = saved ?? (day % 120) + 1;
  return { n: Math.min(n, limit), label: n > limit ? '已讀一回' : saved ? '接着讀' : '今日一回' };
}

/* 回次和链接先准备好，只有书进入视口才创建画布和取原文。 */
export function prepareBook(root: HTMLElement) {
  const titles: [string, string][] = JSON.parse(root.querySelector('[data-kb-titles]')!.textContent!);
  let saved: number | null = null;
  try {
    const last = JSON.parse(localStorage.getItem('hlm-last') || 'null');
    if (Number.isInteger(last?.n) && last.n >= 1 && last.n <= 120) saved = last.n;
  } catch { /* 本机记录不可用时按当天回次开卷。 */ }
  let selected = initialBookChapter(saved, bookLimit());
  const cap = (n: number, label: string) => {
    selected = { n, label };
    const [cn, title] = titles[n - 1];
    root.querySelector<HTMLAnchorElement>('[data-kb-link]')!.href = `/chapters/${n}/`;
    root.querySelector('[data-kb-label]')!.textContent = label;
    root.querySelector('[data-kb-cn]')!.textContent = cn;
    root.querySelector('[data-kb-title]')!.textContent = title;
    for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-kb-l],[data-kb-r]')) link.href = `/chapters/${n}/`;
  };
  cap(selected.n, selected.label);
  let book: ReturnType<typeof mountBook> | null = null;
  new IntersectionObserver(entries => {
    const visible = entries.some(entry => entry.isIntersecting);
    if (!book && visible) book = mountBook(root, selected, cap);
    else book?.setVisible(visible);
  }).observe(root);
  addEventListener('hlm:progress', () => {
    if (book) book.limitChanged();
    else if (selected.n > bookLimit()) cap(bookLimit(), '已讀一回');
  });
}

function mountBook(root: HTMLElement, initial: BookChapter, cap: (n: number, label: string) => void) {
  const probe = root.querySelector<HTMLElement>('[data-kb-u]')!;
  const turn = root.querySelector<HTMLButtonElement>('[data-kb-turn]')!;
  const status = root.querySelector<HTMLElement>('[data-kb-status]')!;
  const cv = { l: root.querySelector<HTMLCanvasElement>('[data-kb-cl]')!, r: root.querySelector<HTMLCanvasElement>('[data-kb-cr]')! };
  const blocks = { l: root.querySelector<HTMLElement>('[data-kb-l]')!, r: root.querySelector<HTMLElement>('[data-kb-r]')! };
  const glCv = root.querySelector<HTMLCanvasElement>('[data-kb-gl]')!;
  const edges = { l: root.querySelector<HTMLCanvasElement>('[data-kb-el]')!, r: root.querySelector<HTMLCanvasElement>('[data-kb-er]')! };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 760px)');
  const curl = reduced ? null : Curl.create(glCv);

  let g: Geom = geom(probe.offsetWidth || 32);
  let dpr = Math.min(2, devicePixelRatio || 1);
  let cur: Spread | null = null;
  let busy = false;
  let visible = true;
  let revision = 0;
  let requested = initial;
  let pending: BookChapter | null = null;
  let retry: (() => Promise<void>) | null = null;
  const setBusy = (on: boolean) => {
    busy = on;
    turn.disabled = on;
    turn.textContent = on ? (cur ? '正在翻頁' : '正在開卷') : '隨手翻';
    root.setAttribute('aria-busy', String(on));
  };
  const reportError = (error: unknown) => {
    setBusy(false);
    status.textContent = '這頁未能載入，請再試一次。';
    status.hidden = false;
    turn.textContent = '重試';
    console.error('刻本載入失敗', error);
  };

  /* 两边书叶的厚度：读过的在右，没读的在左。只在书口和书根露出几道纸边 */
  const thickOf = (n: number) => ({ l: 1.2 + 4.8 * (120 - n) / 119, r: 1.2 + 4.8 * (n - 1) / 119 });
  let thick = { l: 0, r: 0 };
  const setThick = (t: { l: number; r: number }) => {
    thick = t;
    for (const s of ['l', 'r'] as const) drawEdge(edges[s], g, dpr, s, t[s]);
  };

  const spreads = new Map<number, Promise<Spread>>();
  const load = (n: number) => {
    if (!spreads.has(n)) spreads.set(n, fetch(`/kanben/${n}.json`).then(r => {
      if (!r.ok) throw new Error(`刻本请求失败 ${r.status}`);
      return r.json() as Promise<Spread>;
    }).catch(error => { spreads.delete(n); throw error; }));
    return spreads.get(n)!;
  };
  /* 样式和字形都到齐才画字，避免把临时替代字体存进画布缓存。 */
  let refreshFontStyle = false;
  async function glyphs(sp: Spread) {
    const style = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href="/fonts/fonts.css"]')!;
    const refresh = refreshFontStyle;
    refreshFontStyle = false;
    if (!style.sheet || refresh) await new Promise<void>((resolve, reject) => {
      const loaded = () => { style.removeEventListener('error', failed); resolve(); };
      const failed = () => { style.removeEventListener('load', loaded); reject(new Error('字体样式未能载入')); };
      style.addEventListener('load', loaded, { once: true });
      style.addEventListener('error', failed, { once: true });
      if (refresh || document.readyState === 'complete') style.href = style.href;
    });
    try {
      const loaded = await document.fonts.load('20px "HLM Qiji"', textOf(sp));
      if (!loaded.length) throw new Error('刻本字体未能载入');
    } catch (error) { refreshFontStyle = true; throw error; }
  }

  /* 画好的页面，按回和面存几张 */
  const faces = new Map<string, HTMLCanvasElement>();
  const face = (sp: Spread, side: Side) => {
    const key = `${sp.n}${side}${g.u}`;
    let c = faces.get(key);
    if (!c) {
      c = document.createElement('canvas');
      sizeCanvas(c, g, dpr);
      drawPage(c, g, dpr, sp, side);
      faces.set(key, c);
      if (faces.size > 24) faces.delete(faces.keys().next().value!);
    }
    return c;
  };
  const paint = (side: Side, src: HTMLCanvasElement) => {
    const ctx = cv[side].getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(src, 0, 0);
  };

  function measure() {
    g = geom(probe.offsetWidth || 32);
    dpr = Math.min(2, devicePixelRatio || 1);
    faces.clear();
    root.style.setProperty('--pw', g.W + 'px');
    root.style.setProperty('--ph', g.H + 'px');
    for (const s of ['l', 'r'] as const) sizeCanvas(cv[s], g, dpr);
    if (thick.l) setThick(thick);
    if (curl) {
      /* 卷起的纸会高出书页、伸出书口，画布四周留出余地 */
      const mx = g.W * .2, my = g.H * .32, mb = g.H * .12;
      glCv.style.left = -mx + 'px';
      glCv.style.top = -my + 'px';
      curl.layout(g.W, g.H, mx + g.W, my, g.W * 2 + mx * 2, g.H + my + mb, dpr);
    }
  }
  function show(sp: Spread) {
    cur = sp;
    for (const s of ['l', 'r'] as const) paint(s, face(sp, s));
  }
  /* 远跳最多带过一叶，触屏和减少动画模式只取目标回。 */
  function route(from: number, to: number) {
    const k = curl && !narrow.matches && Math.abs(to - from) > 24 ? 2 : 1;
    const ns: number[] = [];
    for (let i = 1; i < k; i++) ns.push(Math.round(from + (to - from) * i / k));
    ns.push(to);
    return ns;
  }

  /* 翻页操作发起以后才取字、画页。 */
  async function prepare(n: number, run: number) {
    const ns = route(cur!.n, n);
    const sps = await Promise.all(ns.map(load));
    if (run !== revision) return null;
    await Promise.all(sps.map(glyphs));
    if (run !== revision) return null;
    sps.forEach(sp => { face(sp, 'l'); face(sp, 'r'); });
    return sps;
  }
  const pickRandom = () => {
    const limit = bookLimit();
    let n = 1 + Math.floor(Math.random() * limit);
    if (n === cur!.n) n = (n % limit) + 1;
    return n;
  };

  /* 翻完停下来，趁空闲把下一次要翻的页一张一张画好，点下去时不必现画。
     先备随手翻的目标，再备左右相邻两回（手拖用）。备不成也不报错，真翻的时候会重来并报错。 */
  let queued = 0;
  let warmRun = 0;
  const idle = () => new Promise<void>(resolve => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 800 });
    else setTimeout(resolve, 80);
  });
  async function warm() {
    if (!cur || !visible) return;
    const run = ++warmRun;
    const from = cur.n;
    const n = pickRandom();
    queued = n;
    const stale = () => run !== warmRun || busy || !visible || cur?.n !== from;
    try {
      const near = [from + 1, from - 1].filter(m => m >= 1 && m <= bookLimit());
      const sps = await Promise.all([...route(from, n), ...near].map(load));
      if (stale()) return;
      await Promise.all(sps.map(glyphs));
      for (const sp of sps) for (const side of ['l', 'r'] as const) {
        await idle();
        if (stale()) return;
        face(sp, side);
      }
    } catch { /* 预备失败不打扰读者 */ }
  }
  const nextRandom = () => {
    const n = queued;
    queued = 0;
    return n && n !== cur!.n && n <= bookLimit() ? n : pickRandom();
  };

  async function go(n: number, label: string) {
    if (busy || !visible || !cur || n === cur.n || n > bookLimit()) return;
    const run = ++revision;
    requested = { n, label };
    setBusy(true);
    status.hidden = true;
    retry = () => go(n, label);
    const from = cur;
    let sps: Spread[] | null;
    try { sps = await prepare(n, run); }
    catch (error) { if (run === revision) reportError(error); return; }
    if (!sps) return;
    const target = sps[sps.length - 1];
    cap(n, label);
    const t0 = thickOf(from.n), t1 = thickOf(n);
    if (!curl || narrow.matches) {
      root.classList.add('fade');
      await new Promise(r => setTimeout(r, reduced ? 0 : 260));
      if (run !== revision) return;
      show(target);
      setThick(t1);
      root.classList.remove('fade');
      done();
      return;
    }
    const dir = n > from.n ? 1 : -1;
    const src: Side = dir > 0 ? 'l' : 'r', dst: Side = dir > 0 ? 'r' : 'l';
    const chain = [from, ...sps];
    const k = sps.length;
    const now = performance.now();
    /* 截图检查时可以放慢 */
    const slow = (window as { __kbSlow?: number }).__kbSlow ?? 1;
    let landed = 0;
    for (let i = 0; i < k; i++) {
      const last = i === k - 1;
      curl.add({
        start: now + i * 210 * slow,
        dur: (last ? (k > 1 ? 1050 : 1150) : 720) * slow,
        s: dir > 0 ? -1 : 1,
        a0: .2 + Math.random() * .14,
        front: face(chain[i], src),
        back: face(chain[i + 1], dst),
        land: () => {
          if (run !== revision) return;
          paint(dst, face(chain[i + 1], dst));
          landed++;
          const p = landed / k;
          setThick({ l: t0.l + (t1.l - t0.l) * p, r: t0.r + (t1.r - t0.r) * p });
          if (landed === k) { cur = target; done(); }
        }
      });
    }
    /* 翻起的那页底下，是最后一叶下面的那一页 */
    paint(src, face(target, src));
  }
  function done() {
    setBusy(false);
    retry = null;
    resize();
    void warm();
  }

  /* 手拖书角：左页往右拖是下一回，右页往左拖是上一回 */
  type Drag = { side: Side; x: number; n: number; leaf: Leaf | null; nb: Spread | null; moved: boolean };
  let drag: Drag | null = null;
  let dragged = false;
  for (const side of ['l', 'r'] as const) {
    const el = blocks[side];
    el.addEventListener('pointerdown', e => {
      if (!curl || !visible || narrow.matches || busy || !cur || e.button !== 0) return;
      const n = cur.n + (side === 'l' ? 1 : -1);
      if (n < 1 || n > bookLimit()) return;
      const pending: Drag = { side, x: e.clientX, n, leaf: null, nb: null, moved: false };
      drag = pending;
      status.hidden = true;
      load(n).then(async sp => {
        if (drag !== pending) return;
        await glyphs(sp);
        if (drag === pending) drag.nb = sp;
      }).catch(error => {
        if (drag !== pending) return;
        drag = null;
        retry = () => go(n, '翻到');
        reportError(error);
      });
    });
  }
  addEventListener('pointermove', e => {
    if (!drag || !curl || !cur) return;
    const dx = (e.clientX - drag.x) * (drag.side === 'l' ? 1 : -1);
    if (dx >= 8) { drag.moved = true; dragged = true; }
    if (!drag.leaf) {
      if (dx < 8 || !drag.nb) return;
      blocks[drag.side].setPointerCapture?.(e.pointerId);
      setBusy(true);
      requested = { n: drag.n, label: '翻到' };
      const src = drag.side, dst: Side = src === 'l' ? 'r' : 'l';
      root.classList.add('dragging');
      drag.leaf = { start: 0, dur: 1, s: src === 'l' ? -1 : 1, a0: .26, manual: 0, front: face(cur, src), back: face(drag.nb, dst), land: () => {} };
      curl.add(drag.leaf);
      paint(src, face(drag.nb, src));
    }
    drag.leaf.manual = Math.max(0, Math.min(.98, dx / (g.W * 1.7)));
    curl.kick();
  });
  addEventListener('pointerup', () => {
    setTimeout(() => { dragged = false; }, 0);
    if (!drag) return;
    const d = drag;
    drag = null;
    root.classList.remove('dragging');
    if (!d.leaf) { if (d.moved) void go(d.n, '翻到'); return; }
    if (!curl || !cur || !d.nb) return;
    const nb = d.nb, from = cur, src = d.side, dst: Side = src === 'l' ? 'r' : 'l';
    const forward = (d.leaf.manual ?? 0) > .3;
    if (forward) {
      d.leaf.land = () => {
        paint(dst, face(nb, dst));
        setThick(thickOf(nb.n));
        cur = nb;
        cap(nb.n, '翻到');
        done();
      };
    }
    curl.release(d.leaf, forward, () => { paint(src, face(from, src)); done(); });
  });
  /* 拖过页的那一下不算点击，不跳进阅读页 */
  for (const side of ['l', 'r'] as const) blocks[side].addEventListener('click', e => { if (dragged || busy) e.preventDefault(); });

  measure();
  setThick(thickOf(initial.n));
  async function open(chapter: BookChapter) {
    const run = ++revision;
    requested = chapter;
    cap(chapter.n, chapter.label);
    setBusy(true);
    status.hidden = true;
    retry = () => open(chapter);
    try {
      const [sp] = await Promise.all([load(chapter.n), loadFiber()]);
      if (run !== revision) return;
      for (const s of ['l', 'r'] as const) drawPage(cv[s], g, dpr, sp, s, true);
      await glyphs(sp);
      if (run !== revision) return;
      show(sp);
      setThick(thickOf(chapter.n));
      delete root.dataset.bookPending;
      root.classList.add('ready');
      done();
    } catch (error) { if (run === revision) reportError(error); }
  }
  void open(initial);

  turn.addEventListener('click', () => { if (retry) void retry(); else if (cur) void go(nextRandom(), '隨手翻到'); });
  function resize() {
    if (!visible) return;
    const u = probe.offsetWidth;
    const nextDpr = Math.min(2, devicePixelRatio || 1);
    if ((Math.abs(u - g.u) < .5 && dpr === nextDpr) || busy) return;
    measure();
    if (cur) show(cur);
  }
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(resize, 200);
  });

  function suspend(chapter: BookChapter) {
    revision++;
    curl?.cancel();
    drag = null;
    pending = chapter;
    requested = chapter;
    retry = null;
    root.classList.remove('dragging', 'fade');
    root.dataset.bookPending = '';
    status.hidden = true;
    setBusy(false);
    cap(chapter.n, chapter.label);
  }
  return {
    setVisible(on: boolean) {
      visible = on;
      if (!on && (busy || drag)) suspend(requested);
      else if (on) {
        resize();
        if (pending) { const chapter = pending; pending = null; void open(chapter); }
      }
    },
    limitChanged() {
      const limit = bookLimit();
      if (requested.n <= limit && (cur?.n ?? 1) <= limit && (drag?.n ?? 1) <= limit) return;
      const chapter = { n: Math.min(cur?.n ?? requested.n, limit), label: '已讀一回' };
      suspend(chapter);
      if (visible) { pending = null; void open(chapter); }
    }
  };
}
