/* 首页那本线装书的控制：开在哪一回、随手翻、手拖书角翻页。
   书从左往右翻：往后翻是左页翻到右边，往前翻是右页翻回左边。读过的叶子摞在右边，没读的在左边。
   下一次随手翻翻到哪回，在空闲时先选好、取回、画好，点下去就开始翻。 */
import { geom, drawPage, drawEdge, sizeCanvas, loadFiber, textOf, type Spread, type Side, type Geom } from './page.ts';
import { Curl, type Leaf } from './curl.ts';

export function mountBook(root: HTMLElement) {
  const spreadEl = root.querySelector<HTMLElement>('[data-kb-spread]')!;
  const probe = root.querySelector<HTMLElement>('[data-kb-u]')!;
  const cv = { l: root.querySelector<HTMLCanvasElement>('[data-kb-cl]')!, r: root.querySelector<HTMLCanvasElement>('[data-kb-cr]')! };
  const blocks = { l: root.querySelector<HTMLElement>('[data-kb-l]')!, r: root.querySelector<HTMLElement>('[data-kb-r]')! };
  const glCv = root.querySelector<HTMLCanvasElement>('[data-kb-gl]')!;
  const edges = { l: root.querySelector<HTMLCanvasElement>('[data-kb-el]')!, r: root.querySelector<HTMLCanvasElement>('[data-kb-er]')! };
  const titles: [string, string][] = JSON.parse(root.querySelector('[data-kb-titles]')!.textContent!);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 760px)');
  const curl = reduced ? null : Curl.create(glCv);

  let g: Geom = geom(probe.offsetWidth || 32);
  let dpr = Math.min(2, devicePixelRatio || 1);
  let cur: Spread | null = null;
  let busy = false;

  /* 两边书叶的厚度：读过的在右，没读的在左。只在书口和书根露出几道纸边 */
  const thickOf = (n: number) => ({ l: 1.2 + 4.8 * (120 - n) / 119, r: 1.2 + 4.8 * (n - 1) / 119 });
  let thick = { l: 0, r: 0 };
  const setThick = (t: { l: number; r: number }) => {
    thick = t;
    for (const s of ['l', 'r'] as const) drawEdge(edges[s], g, dpr, s, t[s]);
  };

  const spreads = new Map<number, Promise<Spread>>();
  const load = (n: number) => {
    if (!spreads.has(n)) spreads.set(n, fetch(`/kanben/${n}.json`).then(r => r.json()).catch(() => { spreads.delete(n); throw new Error('load'); }));
    return spreads.get(n)!;
  };
  /* 字形按需分包下载，canvas 不会自己去取，画之前先取 */
  const glyphs = (sp: Spread) => Promise.race([document.fonts.load('20px "HLM Qiji"', textOf(sp)), new Promise(r => setTimeout(r, 2500))]).catch(() => {});

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
  const cap = (n: number, label: string) => {
    const [cn, t] = titles[n - 1];
    root.querySelector<HTMLAnchorElement>('[data-kb-link]')!.href = `/chapters/${n}/`;
    root.querySelector('[data-kb-label]')!.textContent = label;
    root.querySelector('[data-kb-cn]')!.textContent = cn;
    root.querySelector('[data-kb-title]')!.textContent = t;
    for (const s of ['l', 'r'] as const) blocks[s].setAttribute('href', `/chapters/${n}/`);
  };

  /* 从当前回翻到 n 要经过的几叶：隔得越远带过的越多，每叶都是途经那一回的开头 */
  function route(from: number, to: number) {
    const k = Math.min(5, 1 + Math.round(Math.abs(to - from) / 24));
    const ns: number[] = [];
    for (let i = 1; i < k; i++) ns.push(Math.round(from + (to - from) * i / k));
    ns.push(to);
    return ns;
  }

  /* 预备：取回、取字、画好 */
  let next: { n: number; ready: Promise<Spread[]> } | null = null;
  function prepare(n: number) {
    const ns = route(cur!.n, n);
    const ready = Promise.all(ns.map(load)).then(async sps => {
      await Promise.all(sps.map(glyphs));
      const dir = n > cur!.n ? 1 : -1;
      const src: Side = dir > 0 ? 'l' : 'r', dst: Side = dir > 0 ? 'r' : 'l';
      sps.forEach(sp => { face(sp, src); face(sp, dst); });
      return sps;
    });
    next = { n, ready };
    return ready;
  }
  const pickRandom = () => {
    let n = 1 + Math.floor(Math.random() * 120);
    if (n === cur!.n) n = (n % 120) + 1;
    return n;
  };
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 400));

  async function go(n: number, label: string) {
    if (busy || !cur || n === cur.n) return;
    busy = true;
    const from = cur;
    const sps = next?.n === n ? await next.ready : await prepare(n);
    next = null;
    const target = sps[sps.length - 1];
    cap(n, label);
    const t0 = thickOf(from.n), t1 = thickOf(n);
    if (!curl || narrow.matches) {
      root.classList.add('fade');
      await new Promise(r => setTimeout(r, reduced ? 0 : 260));
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
    busy = false;
    idle(() => { if (cur) prepare(pickRandom()).catch(() => {}); prepareNeighbors(); });
  }

  /* 手拖书角：左页往右拖是下一回，右页往左拖是上一回 */
  const prepareNeighbors = () => {
    if (!cur || !curl) return;
    for (const n of [cur.n - 1, cur.n + 1]) if (n >= 1 && n <= 120) load(n).then(async sp => { await glyphs(sp); face(sp, 'l'); face(sp, 'r'); }).catch(() => {});
  };
  let drag: { side: Side; x: number; n: number; leaf: Leaf | null; nb: Spread | null } | null = null;
  for (const side of ['l', 'r'] as const) {
    const el = blocks[side];
    el.addEventListener('pointerdown', e => {
      if (!curl || narrow.matches || busy || !cur || e.button !== 0) return;
      const n = cur.n + (side === 'l' ? 1 : -1);
      if (n < 1 || n > 120) return;
      drag = { side, x: e.clientX, n, leaf: null, nb: null };
      load(n).then(sp => { if (drag && drag.n === n) drag.nb = sp; }).catch(() => {});
    });
  }
  addEventListener('pointermove', e => {
    if (!drag || !curl || !cur) return;
    const dx = (e.clientX - drag.x) * (drag.side === 'l' ? 1 : -1);
    if (!drag.leaf) {
      if (dx < 8 || !drag.nb) return;
      blocks[drag.side].setPointerCapture?.(e.pointerId);
      busy = true;
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
    if (!drag) return;
    const d = drag;
    drag = null;
    root.classList.remove('dragging');
    if (!d.leaf || !curl || !cur || !d.nb) return;
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
    curl.release(d.leaf, forward, () => { paint(src, face(from, src)); busy = false; });
  });
  /* 拖过页的那一下不算点击，不跳进阅读页 */
  for (const side of ['l', 'r'] as const) blocks[side].addEventListener('click', e => { if (root.classList.contains('dragging') || busy) e.preventDefault(); });

  /* 开卷：接着上次读的那回，没读过就按日子取一回 */
  let last: { n: number } | null = null;
  try { last = JSON.parse(localStorage.getItem('hlm-last') || 'null'); } catch { /* 读不到就当没读过 */ }
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 864e5);
  const first = last?.n || (day % 120) + 1;
  cap(first, last?.n ? '接着讀' : '今日一回');
  measure();
  setThick(thickOf(first));
  Promise.all([load(first), loadFiber()]).then(async ([sp]) => {
    /* 字没到之前先铺上空纸 */
    for (const s of ['l', 'r'] as const) drawPage(cv[s], g, dpr, sp, s, true);
    await glyphs(sp);
    show(sp);
    root.classList.add('ready');
    done();
  });

  root.querySelector('[data-kb-turn]')!.addEventListener('click', () => { if (cur) go(next && !busy ? next.n : pickRandom(), '隨手翻到'); });
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      const u = probe.offsetWidth;
      if (Math.abs(u - g.u) < .5 || busy) return;
      measure();
      if (cur) show(cur);
      next = null;
      done();
    }, 200);
  });
}
