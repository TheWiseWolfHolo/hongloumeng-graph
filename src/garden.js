/* ============ 大观园 ============
   按绢本青绿界画的路子画：先铺绢地、水系和围墙，再起山石、种树，最后放院落、景致和匾额。
   颜色全部走 --gd-* 变量，换成漆夜底时就是月夜的园子。随机量用固定种子，每次画出来都一样。 */
const Garden = (() => {
  const W = 1200, H = 790, WALL = [60, 62, 1140, 736];
  let svg, card, box, sel = 'yhy', seed = 11;
  let tour = null, route = null, reveal = null, marker = null, stops = [], stopEls = [], total = 0, raf = 0;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const rr = (a, b) => a + rnd() * (b - a);
  const r1 = n => Math.round(n * 10) / 10;
  const el = svgEl;

  /* 水面与溪流 */
  const LAKE = [[520, 312], [580, 330], [640, 326], [690, 340], [740, 338], [790, 342], [815, 372], [800, 405], [790, 440], [808, 472], [780, 500], [720, 498], [660, 505], [615, 518], [575, 515], [530, 500], [480, 488], [440, 470], [408, 440], [418, 400], [450, 372], [440, 340], [470, 318]];
  const POND = [[822, 286], [860, 272], [904, 280], [914, 300], [880, 314], [836, 312]];
  const STREAMS = [
    { w: 13, pts: [[1150, 262], [1100, 268], [1050, 282], [990, 270], [935, 282], [885, 292], [848, 300], [815, 322], [795, 348]] },
    { w: 14, pts: [[592, 505], [598, 540], [604, 562], [630, 590], [690, 616], [760, 636], [840, 652], [920, 664], [968, 678], [998, 704], [1012, 746]] },
    { w: 9, pts: [[452, 336], [420, 324], [380, 334], [330, 358], [280, 386], [230, 402], [170, 408], [112, 400]] },
    { w: 5, pts: [[470, 488], [440, 522], [412, 558], [388, 586], [356, 606], [320, 626], [284, 634], [252, 626]] }
  ];
  /* 园中小径：游园路线之外的几条支路 */
  const WALKS = [
    [[812, 296], [850, 266], [920, 262], [990, 244], [1055, 222]],
    [[832, 420], [900, 414], [950, 408]],
    [[650, 238], [664, 290], [694, 316]],
    [[500, 242], [512, 268]],
    [[345, 508], [396, 544], [446, 566], [480, 600]],
    [[850, 480], [818, 458]],
    [[946, 606], [958, 644], [968, 676], [1020, 686], [1048, 686]],
    [[345, 434], [372, 432], [400, 434]]
  ];
  /* [中心 x, 山脚 y, 宽， 高] */
  const HILLS = [
    [118, 128, 150, 60], [190, 122, 96, 40], [80, 124, 60, 30],
    [104, 282, 124, 50], [176, 276, 108, 42], [244, 284, 86, 32],
    [486, 268, 104, 38], [552, 262, 70, 26],
    [636, 300, 84, 34], [702, 302, 150, 72], [780, 298, 92, 44],
    [1020, 132, 124, 48], [1094, 130, 96, 42],
    [1098, 254, 84, 36], [1086, 336, 116, 46],
    [1104, 566, 74, 40], [1112, 616, 60, 30],
    [772, 100, 96, 30]
  ];

  function spline(pts, closed) {
    const n = pts.length, at = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2);
      d += `C${r1(b[0] + (c[0] - a[0]) / 6)} ${r1(b[1] + (c[1] - a[1]) / 6)} ${r1(c[0] - (e[0] - b[0]) / 6)} ${r1(c[1] - (e[1] - b[1]) / 6)} ${c[0]} ${c[1]}`;
    }
    return closed ? d + 'Z' : d;
  }
  const courtSize = b => b.id === 'dgl' ? [280, 112] : [118 * b.sz, 72 * b.sz];
  const ownerColor = b => b.id === 'dgl' ? 'var(--gold2)' : gColor(byId.get(b.who[0]).grp);

  /* ---------- 种树、叠石用的小部件 ---------- */
  function peak(g, x, b, w, h) {
    const l = x - w / 2, r = x + w / 2, t = b - h, sk = rr(-.1, .1) * w, tx = x + sk;
    el('path', { class: 'g-hill', d: `M${r1(l)} ${b}C${r1(l + w * .14)} ${r1(b - h * .45)} ${r1(tx - w * .2)} ${r1(t)} ${r1(tx)} ${r1(t)}C${r1(tx + w * .17)} ${r1(t)} ${r1(r - w * .12)} ${r1(b - h * .5)} ${r1(r)} ${b}Z` }, g);
    let cun = '';
    for (let i = 0, n = 2 + Math.round(w / 45); i < n; i++) {
      const u = rr(-.32, .32), sx = tx + u * w * .45, sy = t + h * (.16 + Math.abs(u) * .5);
      cun += `M${r1(sx)} ${r1(sy)}q${r1(u * w * .22)} ${r1(h * .22)} ${r1(u * w * .08)} ${r1(h * rr(.32, .5))}`;
    }
    el('path', { class: 'g-cun', d: cun }, g);
    for (let i = 0, n = 3 + Math.round(w / 36); i < n; i++) {
      const u = rr(-.3, .3);
      el('circle', { class: 'g-moss', cx: r1(tx + u * w), cy: r1(t + h * (u * u * 2.4 + rr(.03, .1))), r: r1(rr(1, 1.9)) }, g);
    }
  }
  /* 太湖石：高的腰细、多孔，矮的是卧石 */
  function rock(g, x, y, s, tall) {
    const H = (tall ? 34 : 12) * s, rx = (tall ? 9 : 13) * s, n = 6, L = [], R = [], ph = rr(0, 3);
    for (let i = 0; i <= n; i++) {
      const t = i / n, prof = tall ? .62 + .38 * Math.abs(Math.sin(t * 3.4 + ph)) : 1 - t * t * .55;
      L.push([r1(x - rx * prof * rr(.8, 1.1) + (tall ? Math.sin(t * 4 + ph) * 2 * s : 0)), r1(y - t * H)]);
      R.push([r1(x + rx * prof * rr(.8, 1.1) + (tall ? Math.sin(t * 4 + ph) * 2 * s : 0)), r1(y - t * H)]);
    }
    el('path', { class: 'g-rock', d: spline([...L, ...R.reverse()], true) }, g);
    let cun = '';
    for (let i = 0; i < (tall ? 3 : 2); i++) { const cy = y - H * rr(.2, .8), cx = x + rr(-.4, .4) * rx; cun += `M${r1(cx)} ${r1(cy)}q${r1(3 * s)} ${r1(2 * s)} ${r1(1 * s)} ${r1(6 * s)}`; }
    el('path', { class: 'g-cun', d: cun }, g);
    for (let i = 0; i < (tall ? 4 : 1); i++) el('ellipse', { class: 'g-hole', cx: r1(x + rr(-.35, .35) * rx), cy: r1(y - H * rr(.18, .85)), rx: r1(rr(1.1, 2.2) * s), ry: r1(rr(1.6, 3) * s) }, g);
  }
  /* 叠石假山：一整片起伏的石壁，带孔洞、苔点和藤蔓 */
  function rockery(g, x, y, w, h) {
    const pts = [[x - w / 2, y]], n = 7;
    for (let i = 0; i <= n; i++) {
      const t = i / n, px = x - w / 2 + w * t, ph = h * (.45 + .55 * Math.sin(Math.PI * t)) * rr(.75, 1.1);
      pts.push([r1(px + rr(-4, 4)), r1(y - ph)]);
    }
    pts.push([x + w / 2, y]);
    el('path', { class: 'g-rock screen', d: spline(pts, true) }, g);
    let cun = '';
    for (let i = 1; i < n; i++) { const px = x - w / 2 + w * i / n; cun += `M${r1(px)} ${r1(y - h * rr(.35, .7))}q${r1(rr(-5, 5))} ${r1(h * .2)} ${r1(rr(-3, 3))} ${r1(h * .35)}`; }
    el('path', { class: 'g-cun', d: cun }, g);
    for (let i = 0; i < 7; i++) el('ellipse', { class: 'g-hole', cx: r1(x + rr(-.38, .38) * w), cy: r1(y - h * rr(.25, .65)), rx: r1(rr(1.6, 3)), ry: r1(rr(2.2, 4)) }, g);
    for (let i = 0; i < 16; i++) el('circle', { class: 'g-moss', cx: r1(x + rr(-.42, .42) * w), cy: r1(y - h * rr(.5, .95)), r: r1(rr(1, 2)) }, g);
    el('path', { class: 'g-vine', d: `M${r1(x - w * .3)} ${r1(y - h * .7)}q8 10 4 22M${r1(x + w * .1)} ${r1(y - h * .85)}q-6 12 2 26M${r1(x + w * .32)} ${r1(y - h * .6)}q6 8 2 18` }, g);
  }
  function tree(g, x, y, s, kind = 'leaf') {
    el('path', { class: 'g-trunk', d: `M${r1(x)} ${r1(y)}q${r1(rr(-2, 2) * s)} ${r1(-6 * s)} ${r1(rr(-1.5, 1.5) * s)} ${r1(-12 * s)}` }, g);
    const cy = y - 16 * s, R = (kind === 'wutong' ? 13 : 10) * s;
    el('circle', { class: `g-crown ${kind}`, cx: r1(x), cy: r1(cy), r: r1(R) }, g);
    for (let i = 0, n = kind === 'wutong' ? 7 : 9; i < n; i++) {
      const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * .82;
      el('circle', { class: `g-dot ${kind}`, cx: r1(x + Math.cos(a) * d), cy: r1(cy + Math.sin(a) * d * .85), r: r1(rr(1.5, 2.5) * s * (kind === 'wutong' ? 1.6 : 1)) }, g);
    }
  }
  function plum(g, x, y, s) {
    el('path', { class: 'g-branch', d: `M${r1(x)} ${r1(y)}q${r1(-3 * s)} ${r1(-8 * s)} ${r1(2 * s)} ${r1(-14 * s)}t${r1(-4 * s)} ${r1(-10 * s)}M${r1(x + s)} ${r1(y - 9 * s)}q${r1(6 * s)} ${r1(-2 * s)} ${r1(9 * s)} ${r1(-8 * s)}` }, g);
    for (let i = 0; i < 10; i++) el('circle', { class: 'g-dot plum', cx: r1(x + rr(-7, 10) * s), cy: r1(y - rr(7, 25) * s), r: r1(rr(1.1, 1.9) * s) }, g);
  }
  function willow(g, x, y, s) {
    const tx = x + rr(-2, 2) * s, ty = y - 18 * s;
    el('path', { class: 'g-trunk', d: `M${r1(x)} ${r1(y)}Q${r1(x - 2 * s)} ${r1(y - 9 * s)} ${r1(tx)} ${r1(ty)}` }, g);
    let d = '';
    for (let i = 0; i < 11; i++) {
      const dx = (i - 5) * 2.4 * s;
      d += `M${r1(tx + dx * .3)} ${r1(ty - 2 * s)}q${r1(dx * 1.1)} ${r1(-3 * s)} ${r1(dx * 1.45)} ${r1(rr(12, 20) * s)}`;
    }
    el('path', { class: 'g-willow', d }, g);
  }
  function pine(g, x, y, s) {
    el('path', { class: 'g-trunk', d: `M${r1(x)} ${r1(y)}q${r1(2 * s)} ${r1(-9 * s)} ${r1(-s)} ${r1(-21 * s)}` }, g);
    [[-2, 18, 9], [1, 13, 7.5], [-1, 8.5, 5.5], [0, 22, 4.5]].forEach(([dx, dy, w]) =>
      el('ellipse', { class: 'g-pine', cx: r1(x + dx * s), cy: r1(y - dy * s), rx: r1(w * s), ry: r1(2.3 * s) }, g));
  }
  function bamboo(g, x, y, s, n) {
    let stem = '', leaf = '';
    for (let i = 0; i < n; i++) {
      const bx = x + rr(-9, 9) * s, h = rr(15, 26) * s, lean = rr(-3, 3) * s;
      stem += `M${r1(bx)} ${r1(y)}l${r1(lean)} ${r1(-h)}`;
      for (let k = 0; k < 3; k++) {
        const lx = bx + lean * (.55 + k * .15), ly = y - h * (.5 + k * .18), dir = rnd() < .5 ? -1 : 1;
        leaf += `M${r1(lx)} ${r1(ly)}l${r1(dir * 5.5 * s)} ${r1(2 * s)}M${r1(lx)} ${r1(ly)}l${r1(dir * 4.5 * s)} ${r1(-1.6 * s)}`;
      }
    }
    el('path', { class: 'g-bstem', d: stem }, g);
    el('path', { class: 'g-bleaf', d: leaf }, g);
  }
  function banana(g, x, y, s) {
    let d = '';
    [-64, -32, -4, 26, 58].forEach(a => {
      const rad = (a - 90) * Math.PI / 180, L = rr(13, 18) * s, ex = x + Math.cos(rad) * L, ey = y + Math.sin(rad) * L;
      const nx = -Math.sin(rad) * 4.2 * s, ny = Math.cos(rad) * 4.2 * s, mx = (x + ex) / 2, my = (y + ey) / 2;
      d += `M${r1(x)} ${r1(y)}Q${r1(mx + nx)} ${r1(my + ny)} ${r1(ex)} ${r1(ey)}Q${r1(mx - nx * .35)} ${r1(my - ny * .35)} ${r1(x)} ${r1(y)}Z`;
    });
    el('path', { class: 'g-banana', d }, g);
  }
  function reeds(g, x, y, s, n) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const bx = x + rr(-16, 16) * s, h = rr(8, 14) * s, lean = rr(-3, 3) * s;
      d += `M${r1(bx)} ${r1(y + rr(-2, 2))}q${r1(lean * .3)} ${r1(-h * .5)} ${r1(lean)} ${r1(-h)}`;
      el('ellipse', { class: 'g-plume', cx: r1(bx + lean), cy: r1(y - h - 1.5 * s), rx: r1(1.1 * s), ry: r1(2.6 * s) }, g);
    }
    el('path', { class: 'g-reed', d }, g);
  }

  /* ---------- 房屋 ---------- */
  function roof(g, x, y, w, rh, s) {
    const l = x - w / 2, r = x + w / 2, t = y - rh, k = w * .14;
    el('path', { class: 'g-roof', d: `M${r1(l + k)} ${r1(t)}H${r1(r - k)}C${r1(r - k * .4)} ${r1(t + rh * .55)} ${r1(r + 3 * s)} ${r1(y - s)} ${r1(r + 7 * s)} ${r1(y - 4 * s)}L${r1(r + 4 * s)} ${r1(y + s)}H${r1(l - 4 * s)}L${r1(l - 7 * s)} ${r1(y - 4 * s)}C${r1(l - 3 * s)} ${r1(y - s)} ${r1(l + k * .4)} ${r1(t + rh * .55)} ${r1(l + k)} ${r1(t)}Z` }, g);
    let tiles = '';
    const n = Math.max(4, Math.round(w / (4.6 * s)));
    for (let i = 1; i < n; i++) { const tx = l + k + (w - 2 * k) * i / n; tiles += `M${r1(tx)} ${r1(t + .8)}L${r1(x + (tx - x) * 1.12)} ${r1(y - .6 * s)}`; }
    el('path', { class: 'g-tile', d: tiles }, g);
    el('path', { class: 'g-ridge', d: `M${r1(l + k - 3 * s)} ${r1(t - 2.6 * s)}L${r1(l + k)} ${r1(t)}H${r1(r - k)}L${r1(r - k + 3 * s)} ${r1(t - 2.6 * s)}` }, g);
  }
  /* y 是檐口的高度 */
  function hall(g, x, y, w, s, o = {}) {
    const bays = o.bays || 3, bh = 10 * s, l = x - w / 2;
    el('rect', { class: 'g-plinth', x: r1(l - 2 * s), y: r1(y + bh), width: r1(w + 4 * s), height: r1(3 * s) }, g);
    el('rect', { class: o.temple ? 'g-body temple' : 'g-body', x: r1(l + 3 * s), y: r1(y), width: r1(w - 6 * s), height: r1(bh) }, g);
    const bw = (w - 6 * s) / bays;
    let cols = '';
    for (let i = 0; i < bays; i++) {
      const mid = i === (bays - 1) / 2;
      el('rect', { class: 'g-win', x: r1(l + 3 * s + i * bw + bw * .2), y: r1(y + 2.2 * s), width: r1(bw * .6), height: r1(mid ? bh - 2.2 * s : bh * .48) }, g);
    }
    for (let i = 0; i <= bays; i++) cols += `M${r1(l + 3 * s + i * bw)} ${r1(y)}v${r1(bh)}`;
    el('path', { class: 'g-col', d: cols }, g);
    roof(g, x, y, w, 11 * s, s);
  }
  function tower(g, x, y, w, s, o = {}) {
    hall(g, x, y, w, s, { bays: o.bays || 5 });
    hall(g, x, y - 23 * s, w * .7, s * .92, { bays: 3 });
  }
  function ting(g, x, y, s) {
    el('rect', { class: 'g-plinth', x: r1(x - 11 * s), y: r1(y - 2 * s), width: r1(22 * s), height: r1(3 * s) }, g);
    el('path', { class: 'g-col', d: `M${r1(x - 7 * s)} ${r1(y - 2 * s)}v${r1(-9 * s)}M${r1(x + 7 * s)} ${r1(y - 2 * s)}v${r1(-9 * s)}` }, g);
    const e = y - 11 * s;
    el('path', { class: 'g-roof', d: `M${r1(x - 14 * s)} ${r1(e - 3 * s)}Q${r1(x - 5 * s)} ${r1(e - 3 * s)} ${r1(x)} ${r1(e - 15 * s)}Q${r1(x + 5 * s)} ${r1(e - 3 * s)} ${r1(x + 14 * s)} ${r1(e - 3 * s)}L${r1(x + 10 * s)} ${r1(e + s)}H${r1(x - 10 * s)}Z` }, g);
    el('circle', { class: 'g-finial', cx: r1(x), cy: r1(e - 16 * s), r: r1(1.5 * s) }, g);
  }
  function hut(g, x, y, w, s) {
    el('rect', { class: 'g-mud', x: r1(x - w / 2 + 2 * s), y: r1(y), width: r1(w - 4 * s), height: r1(8 * s) }, g);
    el('rect', { class: 'g-win', x: r1(x - 2.5 * s), y: r1(y + 2 * s), width: r1(5 * s), height: r1(6 * s) }, g);
    el('path', { class: 'g-thatch', d: `M${r1(x - w / 2 - 3 * s)} ${r1(y + s)}Q${r1(x - w / 2)} ${r1(y - 9 * s)} ${r1(x)} ${r1(y - 11 * s)}Q${r1(x + w / 2)} ${r1(y - 9 * s)} ${r1(x + w / 2 + 3 * s)} ${r1(y + s)}Z` }, g);
    let d = '';
    for (let i = -2; i <= 2; i++) d += `M${r1(x + i * w * .17)} ${r1(y - 9 * s + Math.abs(i) * 1.6 * s)}l${r1(i * 1.2 * s)} ${r1(7 * s)}`;
    el('path', { class: 'g-thatchl', d }, g);
  }
  function paifang(g, x, y, s) {
    el('path', { class: 'g-col', d: [-24, -9, 9, 24].map(d => `M${r1(x + d * s)} ${r1(y)}v${r1(-19 * s)}`).join('') }, g);
    el('rect', { class: 'g-beam', x: r1(x - 26 * s), y: r1(y - 17 * s), width: r1(52 * s), height: r1(2.6 * s) }, g);
    roof(g, x - 16.5 * s, y - 19 * s, 17 * s, 5 * s, s * .6);
    roof(g, x + 16.5 * s, y - 19 * s, 17 * s, 5 * s, s * .6);
    roof(g, x, y - 23 * s, 22 * s, 6 * s, s * .7);
    el('rect', { class: 'g-tablet', x: r1(x - 6 * s), y: r1(y - 22.5 * s), width: r1(12 * s), height: r1(4.6 * s) }, g);
  }
  function bridge(g, x, y, ang, len) {
    const b = el('g', { transform: `translate(${x} ${y}) rotate(${ang})` }, g);
    el('rect', { class: 'g-bridge', x: -len / 2, y: -4.5, width: len, height: 9, rx: 3 }, b);
    el('path', { class: 'g-rail', d: `M${-len / 2 + 2} -4.5H${len / 2 - 2}M${-len / 2 + 2} 4.5H${len / 2 - 2}` }, b);
  }

  /* 院落的围墙与院门 */
  function court(g, cx, cy, w, h, earth) {
    const x = r1(cx - w / 2), y = r1(cy - h / 2);
    el('rect', { class: 'halo', x: r1(x - 7), y: r1(y - 7), width: r1(w + 14), height: r1(h + 14), rx: 10 }, g);
    el('rect', { class: 'g-cshadow', x: x + 2.5, y: y + 3.5, width: r1(w), height: r1(h), rx: 2 }, g);
    el('rect', { class: earth ? 'g-court earth' : 'g-court', x, y, width: r1(w), height: r1(h), rx: 2 }, g);
    if (earth) {
      el('rect', { class: 'g-cwall earth', x, y, width: r1(w), height: r1(h), rx: 2 }, g);
      el('rect', { class: 'g-straw', x, y, width: r1(w), height: r1(h), rx: 2 }, g);
    } else {
      el('rect', { class: 'g-pave', x: r1(cx - 3.5), y: r1(cy), width: 7, height: r1(h / 2 - 4) }, g);
      el('rect', { class: 'g-cwall', x, y, width: r1(w), height: r1(h), rx: 2 }, g);
      el('rect', { class: 'g-cwall2', x, y, width: r1(w), height: r1(h), rx: 2 }, g);
      const gy = y + h;
      el('rect', { class: 'g-body', x: r1(cx - 7), y: r1(gy - 6), width: 14, height: 9 }, g);
      el('rect', { class: 'g-win', x: r1(cx - 3), y: r1(gy - 4), width: 6, height: 7 }, g);
      roof(g, cx, gy - 6, 18, 5, .55);
    }
  }

  /* ---------- 各院落里的布置 ---------- */
  function interior(g, b, cx, cy, w, h) {
    const x0 = cx - w / 2, y0 = cy - h / 2;
    switch (b.id) {
      case 'dgl':
        el('rect', { class: 'g-plinth', x: 530, y: 160, width: 140, height: 14 }, g);
        [[492, 108], [708, 108], [490, 176], [710, 176]].forEach(([x, y]) => pine(g, x, y, .8));
        el('rect', { class: 'g-corr', x: 530, y: 158, width: 22, height: 6 }, g);
        el('rect', { class: 'g-corr', x: 648, y: 158, width: 22, height: 6 }, g);
        tower(g, 524, 158, 40, .85, { bays: 3 });
        tower(g, 676, 158, 40, .85, { bays: 3 });
        tower(g, 600, 150, 112, 1.15);
        break;
      case 'yhy':
        hall(g, cx, cy - 12, 74, 1.05, { bays: 5 });
        hall(g, x0 + 22, cy + 6, 26, .75, { bays: 1 });
        hall(g, x0 + w - 22, cy + 6, 26, .75, { bays: 1 });
        banana(g, cx - 30, cy + 36, 1.15);
        tree(g, cx + 32, cy + 38, 1.05, 'blossom');
        rock(g, cx - 4, cy + 36, .55);
        break;
      case 'xxg': {
        const sp = [[x0 + w - 6, cy - 22], [cx + 28, cy - 14], [cx - 6, cy + 16], [cx - 40, cy + 22], [x0 + 6, cy + 14]];
        el('path', { class: 'g-bank', d: spline(sp, false), 'stroke-width': 7 }, g);
        el('path', { class: 'g-stream', d: spline(sp, false), 'stroke-width': 4 }, g);
        tree(g, cx + 40, cy - 16, .8, 'pear');
        hall(g, cx + 6, cy - 12, 50, .95, { bays: 3 });
        [[x0 + 16, cy - 18], [x0 + 22, cy + 34], [cx - 2, cy + 38], [x0 + w - 18, cy + 36], [cx + 30, cy + 22], [x0 + 40, cy + 8]].forEach(([x, y]) => bamboo(g, x, y, .9, 6));
        break;
      }
      case 'hwy':
        hall(g, cx, cy - 16, 66, 1.05, { bays: 5 });
        let vine = '';
        [[x0 + 8, y0 + 10], [x0 + w - 44, y0 + 10], [x0 + 8, cy + 18]].forEach(([x, y]) => { vine += `M${r1(x)} ${r1(y)}q5 -6 10 0t10 0t10 0t10 0`; });
        el('path', { class: 'g-vine', d: vine }, g);
        for (let i = 0; i < 16; i++) el('circle', { class: 'g-herb', cx: r1(x0 + rr(10, w - 10)), cy: r1(cy + rr(14, h / 2 - 6)), r: r1(rr(1.4, 2.4)) }, g);
        rock(g, cx, cy + 34, 1.3, true);
        break;
      case 'qsz':
        hall(g, cx + 12, cy - 10, 70, 1.0, { bays: 3 });
        tree(g, x0 + 24, cy + 30, 1.25, 'wutong');
        banana(g, x0 + w - 18, cy + 30, 1.05);
        break;
      case 'dxc':
        for (let i = 0; i < 7; i++) tree(g, x0 + rr(14, w - 14), cy + rr(-h / 2 + 18, h / 2 - 4), rr(.6, .8), 'blossom');
        hut(g, cx - 22, cy - 8, 34, 1);
        hut(g, cx + 24, cy + 2, 28, .9);
        hut(g, cx - 4, cy + 22, 24, .85);
        el('path', { class: 'g-pole', d: `M${r1(x0 + w - 8)} ${r1(y0 + 4)}v-30` }, g);
        el('path', { class: 'g-flag', d: `M${r1(x0 + w - 8)} ${r1(y0 - 24)}h12v15l-3 -2l-3 2l-3 -2l-3 2Z` }, g);
        break;
      case 'zlz':
        tree(g, x0 + 16, cy + 24, .75);
        tree(g, x0 + w - 16, cy + 24, .75, 'dark');
        tower(g, cx, cy + 6, 60, 1.0);
        break;
      case 'nxw':
        plum(g, x0 + 18, cy + 30, .85);
        pine(g, x0 + w - 16, cy + 30, .8);
        hall(g, cx, cy - 6, 56, .95, { bays: 3 });
        break;
      case 'lcan':
        plum(g, x0 + 18, cy + 30, .8);
        plum(g, x0 + w - 18, cy + 30, .8);
        hall(g, cx, cy - 8, 60, 1.0, { bays: 3, temple: true });
        el('rect', { class: 'g-plinth', x: r1(cx - 4), y: r1(cy + 20), width: 8, height: 6 }, g);
        break;
    }
  }

  /* 竖匾和下面的小印 */
  function plaque(g, b) {
    const [cx, top] = b.plq, ch = [...b.name], bw = 30, bh = ch.length * 22 + 14;
    el('path', { class: 'gp-string', d: `M${cx - 9} ${top + 1}L${cx} ${top - 9}L${cx + 9} ${top + 1}` }, g);
    el('circle', { class: 'gp-nail', cx, cy: top - 9, r: 1.8 }, g);
    el('rect', { class: 'gp-board', x: cx - bw / 2, y: top, width: bw, height: bh, rx: 2 }, g);
    el('rect', { class: 'gp-inner', x: cx - bw / 2 + 3, y: top + 3, width: bw - 6, height: bh - 6, rx: 1 }, g);
    ch.forEach((c, i) => { el('text', { class: 'gp-ch', x: cx, y: top + 18 + i * 22 }, g).textContent = c; });
    const sy = top + bh + 6;
    el('rect', { class: 'gp-seal', x: cx - 9, y: sy, width: 18, height: 27, rx: 2 }, g);
    [...b.seal].forEach((c, i) => { el('text', { class: 'gp-st', x: cx, y: sy + 8 + i * 11 }, g).textContent = c; });
  }

  /* 各处景致的画法 */
  function site(g, b) {
    const [x, y] = b.pos;
    switch (b.id) {
      case 'qft':
        el('path', { class: 'g-bridge', d: `M574 571Q600 553 626 571L626 579Q600 563 574 579Z` }, g);
        el('path', { class: 'g-rail', d: 'M576 569Q600 551 624 569' }, g);
        ting(g, x, y + 2, .95);
        willow(g, 562, 556, .9);
        willow(g, 640, 560, .9);
        break;
      case 'oxx':
        el('path', { class: 'g-zigl', d: 'M402 436H416L422 428H438L444 424H452' }, g);
        el('path', { class: 'g-zig', d: 'M402 436H416L422 428H438L444 424H452' }, g);
        el('rect', { class: 'g-plinth', x: 446, y: 420, width: 44, height: 5 }, g);
        el('path', { class: 'g-pile', d: 'M450 425v6M462 425v6M474 425v6M486 425v6' }, g);
        hall(g, x, y - 10, 38, .8, { bays: 3 });
        break;
      case 'dct':
        el('rect', { class: 'g-corr', x: 756, y: 447, width: 50, height: 6 }, g);
        el('path', { class: 'g-pile', d: 'M762 453v5M774 453v5M786 453v5M798 453v5' }, g);
        el('rect', { class: 'g-plinth', x: 734, y: 452, width: 28, height: 5 }, g);
        ting(g, x, y + 1, .85);
        break;
      case 'lxa':
        reeds(g, 486, 314, 1, 14);
        reeds(g, 548, 312, 1, 10);
        hut(g, 500, 284, 26, .9);
        hut(g, 528, 290, 20, .8);
        break;
      case 'ajg':
        el('rect', { class: 'g-plinth', x: 684, y: 330, width: 32, height: 6 }, g);
        hall(g, x, y - 2, 30, .75, { bays: 3 });
        break;
      case 'hz':
        el('path', { class: 'g-mound', d: `M${x - 16} ${y}Q${x - 12} ${y - 13} ${x} ${y - 14}Q${x + 12} ${y - 13} ${x + 16} ${y}Z` }, g);
        for (let i = 0; i < 14; i++) el('circle', { class: 'g-petal', cx: r1(x + rr(-26, 26)), cy: r1(y + rr(-24, 6)), r: r1(rr(1, 1.8)) }, g);
        el('path', { class: 'g-hoe', d: `M${x + 20} ${y + 2}l10 -20M${x + 28} ${y - 19}l5 3` }, g);
        tree(g, x - 30, y - 2, .9, 'blossom');
        break;
    }
  }

  /* ---------- 摆放：先占位，再在空处种树 ---------- */
  const blocked = [];
  const block = (x0, y0, x1, y1) => blocked.push([x0, y0, x1, y1]);
  function inPoly(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function nearLine(pts, x, y, d) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < d) return true;
    }
    return false;
  }
  function free(x, y, planted) {
    if (x < 80 || x > 1120 || y < 96 || y > 718) return false;
    if (inPoly(LAKE, x, y) || inPoly(LAKE, x, y + 8) || inPoly(POND, x, y)) return false;
    if (STREAMS.some(s => nearLine(s.pts, x, y, s.w / 2 + 9))) return false;
    if (nearLine(GARDEN_TOUR_PATH, x, y, 8) || WALKS.some(w => nearLine(w, x, y, 8))) return false;
    if (blocked.some(([a, b, c, d]) => x > a && x < c && y > b && y < d)) return false;
    return !planted.some(([px, py]) => Math.hypot(px - x, py - y) < 17);
  }

  function draw() {
    svg.innerHTML = '';
    seed = 11;
    const defs = el('defs', null, svg);
    defs.innerHTML = `
      <linearGradient id="gdHill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="gd-h1"/><stop offset=".5" class="gd-h2"/><stop offset="1" class="gd-h3"/></linearGradient>
      <radialGradient id="gdLake" cx=".52" cy=".42" r=".62"><stop offset="0" class="gd-w1"/><stop offset="1" class="gd-w2"/></radialGradient>
      <pattern id="gdWave" width="30" height="13" patternUnits="userSpaceOnUse"><path d="M1 9Q8.5 3 15 9T29 9" class="gd-wave"/></pattern>
      <filter id="gdGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .28  0 0 0 0 .22  0 0 0 0 .12  0 0 0 .9 -.32"/></filter>
      <filter id="gdSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
      <clipPath id="gdIn"><rect x="64" y="66" width="1072" height="666"/></clipPath>
      <filter id="gdBlur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
      <mask id="gdTourMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path id="gdTourReveal" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/></mask>`;

    /* 装裱、绢地与园内地面 */
    el('rect', { class: 'g-mount', width: W, height: H }, svg);
    el('rect', { class: 'g-silk', x: 12, y: 12, width: W - 24, height: H - 24, rx: 4 }, svg);
    el('rect', { class: 'g-ground', x: WALL[0], y: WALL[1], width: WALL[2] - WALL[0], height: WALL[3] - WALL[1] }, svg);
    const lawn = el('g', { class: 'g-lawns', filter: 'url(#gdSoft)', 'clip-path': 'url(#gdIn)' }, svg);
    for (let i = 0; i < 22; i++) el('ellipse', { class: 'g-lawn', cx: r1(rr(100, 1100)), cy: r1(rr(100, 700)), rx: r1(rr(40, 90)), ry: r1(rr(18, 40)) }, lawn);

    /* 水 */
    const water = el('g', { 'clip-path': 'url(#gdIn)' }, svg);
    STREAMS.forEach(s => {
      const d = spline(s.pts, false);
      el('path', { class: 'g-bank', d, 'stroke-width': s.w + 4 }, water);
      el('path', { class: 'g-stream', d, 'stroke-width': s.w }, water);
    });
    el('path', { class: 'g-lake', d: spline(POND, true) }, water);
    const lakeD = spline(LAKE, true);
    el('path', { class: 'g-lake', d: lakeD }, water);
    el('path', { class: 'g-lakewave', d: lakeD }, water);
    [.9, .78].forEach(k => el('path', { class: 'g-ripple', d: lakeD, transform: `translate(608 412) scale(${k}) translate(-608 -412)` }, water));
    el('ellipse', { class: 'g-moonref', cx: 652, cy: 404, rx: 34, ry: 10, filter: 'url(#gdBlur3)' }, water);
    el('ellipse', { class: 'g-moonref', cx: 652, cy: 404, rx: 13, ry: 3.6 }, water);
    for (let i = 0; i < 26; i++) {
      const [x, y] = i < 16 ? [rr(430, 548), rr(442, 488)] : [rr(520, 600), rr(470, 506)];
      if (!inPoly(LAKE, x, y) || (Math.abs(x - 468) < 30 && Math.abs(y - 424) < 14)) continue;
      el('ellipse', { class: 'g-lotus', cx: r1(x), cy: r1(y), rx: r1(rr(4.5, 7)), ry: r1(rr(2.6, 3.8)) }, water);
      if (rnd() < .3) el('circle', { class: 'g-lflower', cx: r1(x + 3), cy: r1(y - 3), r: 2.1 }, water);
    }
    for (let i = 0; i < 14; i++) {
      const x = rr(830, 905), y = rr(282, 306);
      if (inPoly(POND, x, y)) el('path', { class: 'g-ling', d: `M${r1(x)} ${r1(y - 2.6)}l3 2.6l-3 2.6l-3 -2.6Z` }, water);
    }
    const flow = el('path', { id: 'gdFlow', d: spline([[650, 626], [740, 650], [830, 668], [900, 680]], false), fill: 'none' }, water);
    const ft = el('text', { class: 'g-flow' }, water);
    const tp = el('textPath', { href: '#gdFlow', startOffset: '18%' }, ft);
    tp.textContent = '沁芳溪';
    void flow;

    /* 田畦（稻香村） */
    const fields = el('g', null, svg);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const x = 102 + c * 29 + r * 5, y = 424 + r * 15;
      el('path', { class: `g-field ${(r + c) % 2 ? 'a' : 'b'}`, d: `M${x} ${y}h26l-3 13h-26Z` }, fields);
    }
    block(96, 418, 260, 472);

    /* 小径与桥 */
    const walks = el('g', { 'clip-path': 'url(#gdIn)' }, svg);
    const allWalks = [GARDEN_TOUR_PATH, ...WALKS];
    allWalks.forEach(w => el('path', { class: 'g-walkbed', d: spline(w, false) }, walks));
    allWalks.forEach(w => el('path', { class: 'g-walk', d: spline(w, false) }, walks));
    bridge(walks, 820, 322, 72, 30);
    bridge(walks, 194, 406, 74, 26);
    bridge(walks, 341, 616, 4, 18);
    /* 沁芳闸 */
    el('rect', { class: 'g-bridge', x: 954, y: 668, width: 30, height: 9, rx: 2, transform: 'rotate(22 969 672)' }, walks);
    el('path', { class: 'g-pile', d: 'M958 662v18M980 670v18' }, walks);

    /* 山石 */
    const hills = el('g', { 'clip-path': 'url(#gdIn)' }, svg);
    const mist = el('g', { filter: 'url(#gdSoft)' }, hills);
    [...HILLS].sort((a, b) => a[1] - b[1]).forEach(([x, b, w, h]) => {
      peak(hills, x, b, w, h);
      el('ellipse', { class: 'g-mist', cx: x, cy: b - 4, rx: w * .45, ry: 7 }, mist);
    });
    /* 翠嶂与蓼汀花溆的石洞 */
    rockery(hills, 600, 700, 150, 44);
    rock(hills, 524, 700, .8);
    rock(hills, 678, 702, .7);
    rock(hills, 416, 324, 1.6);
    el('ellipse', { class: 'g-cave', cx: 418, cy: 322, rx: 8, ry: 4.5 }, hills);
    [[110, 230], [880, 640], [1100, 470], [420, 640], [760, 560], [160, 160], [990, 300]].forEach(([x, y]) => rock(hills, x, y, rr(.6, 1)));

    /* 占位：院落、匾额、景致、标注 */
    GARDEN.forEach(b => {
      if (b.kind === 'home') {
        const [w, h] = courtSize(b);
        block(b.pos[0] - w / 2 - 8, b.pos[1] - h / 2 - 24, b.pos[0] + w / 2 + 8, b.pos[1] + h / 2 + 10);
        block(b.plq[0] - 20, b.plq[1] - 14, b.plq[0] + 20, b.plq[1] + 128);
      } else {
        block(b.pos[0] - 30, b.pos[1] - 36, b.pos[0] + 30, b.pos[1] + 14);
        const [lx, ly, an] = b.lab, lw = b.name.length * 17;
        const l0 = an === 'start' ? lx : an === 'end' ? lx - lw : lx - lw / 2;
        block(l0 - 4, ly - 18, l0 + lw + 4, ly + 6);
      }
    });
    block(70, 486, 150, 720);
    block(540, 196, 660, 244);
    block(684, 196, 740, 246);
    block(360, 286, 440, 306);
    block(530, 636, 670, 726);

    /* 园中的树 */
    const veg = el('g', { 'clip-path': 'url(#gdIn)' }, svg);
    const planted = [];
    const special = [
      ['willow', 404, 396], ['willow', 396, 462], ['willow', 524, 520], ['willow', 690, 520], ['willow', 760, 514], ['willow', 826, 400], ['willow', 826, 486], ['willow', 580, 326], ['willow', 456, 312],
      ['plum', 980, 150], ['plum', 1130, 200], ['plum', 1000, 232], ['plum', 1120, 240], ['plum', 960, 196], ['plum', 1082, 236],
      ['blossom', 92, 330], ['blossom', 256, 340], ['blossom', 252, 300], ['blossom', 98, 380], ['blossom', 140, 290],
      ['bamboo', 250, 584], ['bamboo', 412, 600], ['bamboo', 408, 640], ['bamboo', 250, 650], ['bamboo', 300, 676], ['bamboo', 360, 676], ['bamboo', 410, 676], ['bamboo', 280, 566],
      ['banana', 966, 560], ['pine', 1040, 96], ['pine', 1106, 92], ['pine', 132, 80], ['pine', 196, 90]
    ];
    special.forEach(([k, x, y]) => {
      planted.push([x, y]);
      if (k === 'willow') willow(veg, x, y, 1);
      else if (k === 'plum') plum(veg, x, y, .9);
      else if (k === 'blossom') tree(veg, x, y, .85, 'blossom');
      else if (k === 'bamboo') bamboo(veg, x, y, 1, 7);
      else if (k === 'banana') banana(veg, x, y, 1);
      else pine(veg, x, y, 1);
    });
    const trees = [];
    for (let tries = 0; tries < 2400 && trees.length < 96; tries++) {
      const x = rr(80, 1120), y = rr(96, 718);
      if (!free(x, y, planted)) continue;
      planted.push([x, y]);
      trees.push([x, y]);
    }
    trees.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => {
      const onHill = HILLS.some(([hx, hb, hw, hh]) => Math.abs(x - hx) < hw * .35 && y < hb && y > hb - hh * .8);
      if (onHill) pine(veg, x, y, rr(.75, .95));
      else tree(veg, x, y, rr(.75, 1.05), rnd() < .3 ? 'dark' : 'leaf');
    });

    /* 围墙、水门与正门 */
    const wall = el('g', null, svg);
    const wd = `M${WALL[0]} ${WALL[1]}H${WALL[2]}V${WALL[3]}H${WALL[0]}Z`;
    ['g-wall1', 'g-wall2', 'g-wall3'].forEach(c => el('path', { class: c, d: wd }, wall));
    el('path', { class: 'g-sluice', d: 'M1133 254a7 8 0 0 1 14 0v16h-14Z' }, wall);
    el('path', { class: 'g-sluice', d: 'M1004 742a8 7 0 0 1 16 0v-12h-16Z' }, wall);
    hall(wall, 600, 724, 96, 1.05, { bays: 5 });
    paifang(wall, 600, 236, 1.1);

    /* 院落 */
    GARDEN.filter(b => b.kind === 'home').forEach(b => {
      const g = el('g', { class: 'g-home', 'data-id': b.id, tabindex: 0, role: 'button', 'aria-label': `${b.name},${b.who.slice(0, 3).join('、')}` }, svg);
      g.style.setProperty('--c', ownerColor(b));
      const [w, h] = courtSize(b);
      court(g, b.pos[0], b.id === 'dgl' ? 138 : b.pos[1], w, h, b.id === 'dxc');
      interior(g, b, b.pos[0], b.id === 'dgl' ? 138 : b.pos[1], w, h);
      if (b.id === 'dgl') { const hit = el('rect', { class: 'g-hit', x: 572, y: 198, width: 56, height: 40 }, g); void hit; }
    });
    /* 景致 */
    const labels = el('g', null, svg);
    GARDEN.filter(b => b.kind === 'site').forEach(b => {
      const g = el('g', { class: 'g-site', 'data-id': b.id, tabindex: 0, role: 'button', 'aria-label': b.name }, svg);
      el('circle', { class: 'halo', cx: b.pos[0], cy: b.pos[1] - 8, r: 26 }, g);
      el('circle', { class: 'g-hit', cx: b.pos[0], cy: b.pos[1] - 8, r: 24 }, g);
      site(g, b);
      const [lx, ly, an] = b.lab;
      el('text', { class: 'g-sl', x: lx, y: ly, 'text-anchor': an }, g).textContent = b.name;
    });
    [['凸碧山庄', 702, 212, 'middle'], ['翠嶂', 682, 700, 'start'], ['蓼汀花溆', 372, 302, 'middle'], ['沁芳闸', 944, 704, 'end'], ['正门', 600, 772, 'middle']].forEach(([t, x, y, an]) => {
      el('text', { class: 'g-ml', x, y, 'text-anchor': an }, labels).textContent = t;
    });
    ting(labels, 702, 240, .7);

    /* 匾额放最上层，和院落共用一个可点的组 */
    GARDEN.filter(b => b.kind === 'home').forEach(b => {
      const g = $(`.g-home[data-id="${b.id}"]`, svg);
      plaque(g, b);
    });

    /* 题款、北向与绢纹 */
    const ins = el('g', { class: 'g-ins' }, svg);
    [...'大观园图'].forEach((c, i) => { el('text', { class: 'gi-t', x: 120, y: 528 + i * 38 }, ins).textContent = c; });
    [...'仿惜春奉命画园之意'].forEach((c, i) => { el('text', { class: 'gi-s', x: 88, y: 532 + i * 15 }, ins).textContent = c; });
    el('rect', { class: 'gi-seal', x: 107, y: 678, width: 26, height: 26, rx: 2 }, ins);
    [['藕', 120, 686], ['榭', 120, 697]].forEach(([c, x, y]) => { el('text', { class: 'gi-sealt', x, y }, ins).textContent = c; });
    const north = el('g', { class: 'g-north', transform: 'translate(1162 37)' }, svg);
    el('circle', { r: 14 }, north);
    el('path', { d: 'M0 -20L3.5 -13H-3.5Z' }, north);
    el('text', { y: 1 }, north).textContent = '北';
    el('rect', { class: 'g-grain', x: 12, y: 12, width: W - 24, height: H - 24, filter: 'url(#gdGrain)' }, svg);

    /* 游园用的路线、站点与行人，平时隐藏 */
    const tg = el('g', { class: 'g-tour' }, svg);
    route = el('path', { class: 'g-route', d: spline(GARDEN_TOUR_PATH, false), mask: 'url(#gdTourMask)' }, tg);
    reveal = $('#gdTourReveal', svg);
    reveal.setAttribute('d', route.getAttribute('d'));
    stopEls = GARDEN_TOUR.map((st, i) => {
      const s = el('g', { class: 'g-stop', transform: `translate(${st.at[0]} ${st.at[1]})` }, tg);
      el('circle', { r: 9 }, s);
      el('text', { y: .5 }, s).textContent = cnNum(i + 1);
      return s;
    });
    marker = el('g', { class: 'g-marker' }, tg);
    el('circle', { class: 'pulse', r: 8 }, marker);
    el('circle', { class: 'core', r: 6.5 }, marker);
    stops = [];
  }

  /* ---------- 交互 ---------- */
  function mark() {
    $$('.g-home, .g-site', svg).forEach(g => g.classList.toggle('on', g.dataset.id === sel));
    $$('#gPlaces .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.id === sel)));
  }
  function render() {
    mark();
    const b = GARDEN.find(x => x.id === sel);
    if (!b) return;
    const evs = (b.ev || []).map(t => EVENTS.find(e => e.t === t)).filter(Boolean);
    const home = b.kind === 'home';
    card.innerHTML = `<div class="gc-top"><span class="gc-kind">${home ? '院落' : '园中景致'}</span>${home ? `<span class="gc-seal" style="--c:${ownerColor(b)}">${esc(b.seal)}</span>` : ''}</div>
      <h3>${esc(b.name)}</h3><div class="al">${esc(b.alias)}</div>
      <p><b>景致</b>${esc(b.scene)}</p><p><b>旧事</b>${esc(b.note)}</p>
      <div class="gc-sec">${home ? '住在这里' : '在这里出现过'}</div><div class="mem">${b.who.map(pill).join('')}</div>
      ${evs.length ? `<div class="gc-sec">书中经历</div><div class="gc-evs">${evs.map(e => `<button class="rel" type="button" data-ev="${e.i}"><span class="role">${chShort(e.c)}</span><span class="main"><span class="nm">${esc(e.t)}</span>${e.late ? '<span class="note">续书</span>' : ''}</span></button>`).join('')}</div>` : ''}`;
  }
  function select(id, center) {
    if (tour) endTour(true);
    sel = id;
    render();
    if (center && box.scrollWidth > box.clientWidth) {
      const b = GARDEN.find(x => x.id === id), k = box.scrollWidth / W;
      box.scrollTo({ left: b.pos[0] * k - box.clientWidth / 2, behavior: 'smooth' });
    }
  }

  /* 游园：路线按站点逐段展开，行人沿路走过去 */
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function measure() {
    total = route.getTotalLength();
    let from = 0;
    stops = GARDEN_TOUR.map(st => {
      let best = from, bd = Infinity;
      for (let L = from; L <= total; L += 4) {
        const p = route.getPointAtLength(L), d = (p.x - st.at[0]) ** 2 + (p.y - st.at[1]) ** 2;
        if (d < bd) { bd = d; best = L; } else if (bd < 16 && d > 900) break;
      }
      for (let L = Math.max(from, best - 4); L <= Math.min(total, best + 4); L += .5) {
        const p = route.getPointAtLength(L), d = (p.x - st.at[0]) ** 2 + (p.y - st.at[1]) ** 2;
        if (d < bd) { bd = d; best = L; }
      }
      from = best;
      return best;
    });
  }
  function setLen(L) {
    tour.len = L;
    reveal.setAttribute('stroke-dasharray', `${r1(L)} ${r1(total + 20)}`);
    const p = route.getPointAtLength(L);
    marker.setAttribute('transform', `translate(${r1(p.x)} ${r1(p.y)})`);
    stopEls.forEach((s, k) => s.classList.toggle('done', stops[k] <= L + 1));
  }
  function tourGo(i) {
    i = Math.max(0, Math.min(GARDEN_TOUR.length - 1, i));
    const from = tour.len, to = stops[i], st = GARDEN_TOUR[i];
    tour.i = i;
    sel = st.site || null;
    mark();
    renderTour();
    cancelAnimationFrame(raf);
    const dur = reduce() ? 0 : Math.min(2600, Math.max(400, Math.abs(to - from) * 2.4)), t0 = performance.now();
    const step = now => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setLen(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    if (box.scrollWidth > box.clientWidth) {
      const k = box.scrollWidth / W;
      box.scrollTo({ left: st.at[0] * k - box.clientWidth / 2, behavior: reduce() ? 'auto' : 'smooth' });
    }
  }
  function renderTour() {
    const st = GARDEN_TOUR[tour.i], n = GARDEN_TOUR.length, last = tour.i === n - 1;
    const siteB = st.site && GARDEN.find(b => b.id === st.site);
    card.innerHTML = `<div class="gc-top"><span class="gc-kind">第十七回 · 大观园试才题对额</span><span class="gc-count">${cnNum(tour.i + 1)} / ${cnNum(n)}</span></div>
      <h3>${esc(st.name)}</h3>
      <ol class="gc-steps">${GARDEN_TOUR.map((s, k) => `<li class="${k < tour.i ? 'done' : k === tour.i ? 'cur' : ''}"><button type="button" data-step="${k}" title="${esc(s.name)}" aria-label="第${cnNum(k + 1)}处 ${esc(s.name)}"></button></li>`).join('')}</ol>
      <p class="gc-text">${esc(st.text)}</p>
      <div class="gc-nav"><button class="btn" type="button" data-tour="prev"${tour.i === 0 ? ' disabled' : ''}>上一处</button><button class="btn primary" type="button" data-tour="${last ? 'end' : 'next'}">${last ? '游园结束' : '下一处'}</button>${last ? '' : '<button class="btn" type="button" data-tour="end">不走了</button>'}</div>
      ${siteB ? `<button class="gc-more" type="button" data-goto="${siteB.id}">看${esc(siteB.name)}的住户与旧事 ›</button>` : ''}
      <p class="gc-hint">键盘左右方向键也能换站。</p>`;
  }
  function startTour() {
    if (!stops.length) measure();
    tour = { i: 0, len: 0 };
    svg.classList.add('touring');
    $('#gTour').textContent = '结束游园';
    setLen(0);
    tourGo(0);
  }
  function endTour(silent) {
    cancelAnimationFrame(raf);
    tour = null;
    svg.classList.remove('touring');
    $('#gTour').textContent = '随贾政一行游园';
    if (!silent) { sel = sel || 'yhy'; render(); }
  }

  function init() {
    svg = $('#gardenSvg');
    card = $('#gcard');
    box = $('.gscroll');
    draw();
    const pick = ev => { const g = ev.target.closest('.g-home, .g-site'); if (g) select(g.dataset.id); };
    svg.addEventListener('click', pick);
    svg.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { const g = ev.target.closest('.g-home, .g-site'); if (g) { ev.preventDefault(); select(g.dataset.id); } } });
    const homes = GARDEN.filter(b => b.kind === 'home'), sites = GARDEN.filter(b => b.kind === 'site');
    $('#gPlaces').innerHTML = `<span>院落</span>${homes.map(b => `<button class="chip" type="button" data-id="${b.id}" aria-pressed="false"><i class="dot" style="--c:${ownerColor(b)}"></i>${esc(b.name)}</button>`).join('')}<i class="br"></i><span>景致</span>${sites.map(b => `<button class="chip" type="button" data-id="${b.id}" aria-pressed="false">${esc(b.name)}</button>`).join('')}`;
    $('#gPlaces').addEventListener('click', ev => { const c = ev.target.closest('.chip'); if (c) select(c.dataset.id, true); });
    $('#gTour').addEventListener('click', () => (tour ? endTour() : startTour()));
    card.addEventListener('click', ev => {
      const t = ev.target.closest('[data-tour],[data-step],[data-goto],[data-ev]');
      if (!t) return;
      if (t.dataset.ev) { Tabs.show('timeline', true); Timeline.focus(+t.dataset.ev); return; }
      if (t.dataset.goto) { select(t.dataset.goto); return; }
      if (t.dataset.step) { tourGo(+t.dataset.step); return; }
      const a = t.dataset.tour;
      if (a === 'prev') tourGo(tour.i - 1);
      else if (a === 'next') tourGo(tour.i + 1);
      else endTour();
    });
    document.addEventListener('keydown', ev => {
      if (!tour || Tabs.cur !== 'garden' || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (ev.key === 'ArrowRight') { tourGo(tour.i + 1); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft') { tourGo(tour.i - 1); ev.preventDefault(); }
      else if (ev.key === 'Escape') endTour();
    });
    render();
    if (box.scrollWidth > box.clientWidth) box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
  }
  return { init, select, startTour };
})();
