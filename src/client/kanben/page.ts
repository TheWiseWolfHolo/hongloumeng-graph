/* 刻本页面画在 canvas 上：静止的两页和翻起来的那张纸用同一份画法，翻页前后不会有一点跳。
   一页从下往上画：纸、纸的纤维和旧色、透过来的反字、版框版心、界行、字、圈点、天头批语、中缝的弯。 */
export type Cell = [number, number, string, number];
export type Mark = [number, number, number];
export type Mei = [number, string, string];
export interface Spread { n: number; cells: Cell[]; marks: Mark[]; mei: Mei[]; back?: Cell[] }
export type Side = 'l' | 'r';

export const COLS = 8;
export const ROWS = 18;

/* 版面尺寸全按行宽 u 算 */
export function geom(u: number) {
  const rh = u * .8, gm = u * .9, bw = u * .62, top = u * 2.9, foot = u * 1.15, pad = u * .2;
  const gridW = u * COLS, gridH = rh * ROWS;
  const W = gm + u * .12 + gridW + bw;
  const H = top + pad * 2 + gridH + foot;
  return { u, rh, gm, bw, top, foot, pad, gridW, gridH, W, H };
}
export type Geom = ReturnType<typeof geom>;

/* 每页的纸都不一样：同一回同一面，每次画出来又是同一个样子 */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let fiber: HTMLImageElement | null = null;
export function loadFiber() {
  if (fiber) return Promise.resolve();
  return new Promise<void>(res => {
    const img = new Image();
    img.onload = () => { fiber = img; res(); };
    img.onerror = () => res();
    img.src = '/textures/zhuzhi.webp';
  });
}

const INK = 'rgb(35 26 18)';
const ZHU = 'rgb(168 40 30)';
const FONT = '"HLM Qiji", "HLM Serif", serif';

export function sizeCanvas(cv: HTMLCanvasElement, g: Geom, dpr: number) {
  cv.width = Math.round(g.W * dpr);
  cv.height = Math.round(g.H * dpr);
  cv.style.width = g.W + 'px';
  cv.style.height = g.H + 'px';
}

/* 第 c 行（0 在最右）正中的横坐标 */
function colX(g: Geom, side: Side, c: number) {
  const x0 = side === 'r' ? g.gm + g.u * .12 : g.bw;
  return x0 + g.gridW - (c + .5) * g.u;
}

/* 字按字形本身的墨框居中，不靠字体的基线，一行里的字才齐 */
function glyph(ctx: CanvasRenderingContext2D, ch: string, cx: number, cy: number) {
  const m = ctx.measureText(ch);
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  ctx.fillText(ch, cx - w / 2 + m.actualBoundingBoxLeft, cy - h / 2 + m.actualBoundingBoxAscent);
}

export function drawPage(cv: HTMLCanvasElement, g: Geom, dpr: number, sp: Spread | null, side: Side, paperOnly = false) {
  const ctx = cv.getContext('2d')!;
  const { u, W, H } = g;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  const rand = rng((sp?.n ?? 0) * 7919 + (side === 'r' ? 1 : 2));

  /* 纸：竹纸的米黄，每页深浅略有出入 */
  const warm = rand() * 6 - 3, light = rand() * 5 - 2.5;
  ctx.fillStyle = `rgb(${239 + light + warm * .4} ${228 + light} ${198 + light - warm})`;
  ctx.fillRect(0, 0, W, H);
  if (fiber) {
    ctx.save();
    /* 纤维要细碎、若有若无，拉长了就像划痕 */
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = .5;
    const pat = ctx.createPattern(fiber, 'repeat')!;
    const ox = rand() * 512, oy = rand() * 512, sc = .36 + rand() * .08;
    pat.setTransform(new DOMMatrix().translate(-ox, -oy).scale(sc));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  /* 旧色：书口和上下边先黄，偶有几点水渍和纸屑 */
  const fore = side === 'r' ? W : 0;
  const ge = ctx.createLinearGradient(fore, 0, side === 'r' ? W - u * .7 : u * .7, 0);
  ge.addColorStop(0, 'rgb(150 105 40 / .13)');
  ge.addColorStop(1, 'rgb(150 105 40 / 0)');
  ctx.fillStyle = ge;
  ctx.fillRect(0, 0, W, H);
  for (const [y0, y1] of [[0, u * .6], [H, H - u * .5]]) {
    const gv = ctx.createLinearGradient(0, y0, 0, y1);
    gv.addColorStop(0, `rgb(150 105 40 / ${.07 + rand() * .05})`);
    gv.addColorStop(1, 'rgb(150 105 40 / 0)');
    ctx.fillStyle = gv;
    ctx.fillRect(0, 0, W, H);
  }
  const stains = Math.floor(rand() * 3);
  for (let i = 0; i < stains; i++) {
    const x = rand() * W, y = rand() * H, r = u * (.3 + rand() * 1.4);
    const gs = ctx.createRadialGradient(x, y, r * .2, x, y, r);
    gs.addColorStop(0, `rgb(160 115 50 / ${.025 + rand() * .03})`);
    gs.addColorStop(.85, `rgb(160 115 50 / ${.03 + rand() * .03})`);
    gs.addColorStop(1, 'rgb(160 115 50 / 0)');
    ctx.fillStyle = gs;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const specks = 6 + Math.floor(rand() * 14);
  for (let i = 0; i < specks; i++) {
    ctx.fillStyle = `rgb(90 60 30 / ${.18 + rand() * .3})`;
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * H, .3 + rand() * .7, .3 + rand() * .5, rand() * 3, 0, 7);
    ctx.fill();
  }

  if (!paperOnly && sp) {
    const top = g.top + g.pad;
    /* 透字：同一张纸折在背后的另一半。它的字从背面透过来，左右反着，
       折口两边对称，所以那一半的第 j 行正好落在这一面第 COLS-1-j 行的位置 */
    const other = side === 'r' ? (sp.back ?? []) : sp.cells.filter(x => x[0] >= COLS * 2 && x[3] < 2).map(([c, r, ch, k]) => [c - COLS * 2, r, ch, k] as Cell);
    if (other.length) {
      ctx.save();
      ctx.filter = `blur(${(.5 + rand() * .3).toFixed(2)}px)`;
      ctx.globalAlpha = .06 + rand() * .025;
      ctx.fillStyle = INK;
      ctx.font = `${u * .64}px ${FONT}`;
      for (const [c, r, ch] of other) {
        const cx = colX(g, side, COLS - 1 - c), cy = top + (r + .5) * g.rh;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(-1, 1);
        glyph(ctx, ch, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  /* 版框：上下单线，中缝一侧外粗内细的双线；书口一侧接版心，版心正中就是折口 */
  ctx.fillStyle = INK;
  ctx.globalAlpha = .82;
  const fx0 = side === 'r' ? g.gm : 0, fx1 = side === 'r' ? W : W - g.gm;
  const fy0 = g.top, fy1 = H - g.foot;
  ctx.fillRect(fx0, fy0, fx1 - fx0, 1.7);
  ctx.fillRect(fx0, fy1 - 1.7, fx1 - fx0, 1.7);
  const gx = side === 'r' ? fx0 : fx1 - 1.9;
  ctx.fillRect(gx, fy0, 1.9, fy1 - fy0);
  ctx.globalAlpha = .6;
  ctx.fillRect(side === 'r' ? gx + 3.6 : gx - 3.6 + 1.9 - 1, fy0, 1, fy1 - fy0);
  /* 半个版心：只留一道界线。鱼尾和版心题字都压在折口上，翻开的书看不全，不画 */
  const bx = side === 'r' ? W - g.bw : g.bw;
  ctx.fillRect(bx - .5, fy0, 1, fy1 - fy0);

  /* 界行 */
  ctx.globalAlpha = .3;
  const x0 = side === 'r' ? g.gm + u * .12 : g.bw;
  for (let c = 1; c < COLS; c++) ctx.fillRect(Math.round((x0 + c * u) * dpr) / dpr - .5, fy0, 1, fy1 - fy0);
  ctx.globalAlpha = 1;

  if (!paperOnly && sp) {
    const top = g.top + g.pad;
    const off = side === 'r' ? 0 : COLS;
    /* 正文：刻本的墨色有浓有淡 */
    ctx.font = `${u * .64}px ${FONT}`;
    ctx.fillStyle = INK;
    for (const [c, r, ch, k] of sp.cells) {
      if (c < off || c >= off + COLS || k > 1) continue;
      ctx.globalAlpha = .84 + rand() * .14;
      glyph(ctx, ch, colX(g, side, c - off), top + (r + .5) * g.rh);
    }
    /* 夹批：双行小字，朱色 */
    ctx.font = `${u * .37}px ${FONT}`;
    ctx.fillStyle = ZHU;
    for (const [c, r, ch, k] of sp.cells) {
      if (c < off || c >= off + COLS || k < 2) continue;
      ctx.globalAlpha = .82 + rand() * .14;
      const cx = colX(g, side, c - off) + (k === 2 ? u * .23 : -u * .23);
      glyph(ctx, ch, cx, top + (r + .5) * g.rh / 2);
    }
    /* 圈点：句末朱圈，句中朱点，在字的右下 */
    ctx.strokeStyle = ZHU;
    ctx.fillStyle = ZHU;
    ctx.lineWidth = 1.2;
    for (const [c, r, k] of sp.marks) {
      if (c < off || c >= off + COLS) continue;
      const cx = colX(g, side, c - off) + u * .31, cy = top + (r + 1) * g.rh - u * .15;
      ctx.globalAlpha = .78 + rand() * .15;
      ctx.beginPath();
      if (k) { ctx.arc(cx, cy, u * .045, 0, 7); ctx.fill(); }
      else { ctx.arc(cx, cy, u * .085, 0, 7); ctx.stroke(); }
    }
    /* 天头批语：小字竖写，从所批那一行的上方写起，一行写满往左接 */
    const fs = u * .36, lh = u * .42, per = Math.max(1, Math.floor((g.top - u * .9) / lh));
    ctx.font = `${fs}px ${FONT}`;
    for (const [c, s] of sp.mei) {
      if (c < off || c >= off + COLS) continue;
      const chars = [...s];
      chars.forEach((ch, i) => {
        ctx.globalAlpha = .8 + rand() * .15;
        glyph(ctx, ch, colX(g, side, c - off) + u * .2 - Math.floor(i / per) * u * .44, u * .55 + (i % per + .5) * lh);
      });
    }
    ctx.globalAlpha = 1;
  }

  /* 纸往中缝里弯下去，靠中缝那一边暗一些；书口是折口，也微微圆 */
  const gut = side === 'r' ? 0 : W;
  const gg = ctx.createLinearGradient(gut, 0, side === 'r' ? W * .16 : W * .84, 0);
  gg.addColorStop(0, 'rgb(70 45 12 / .26)');
  gg.addColorStop(.18, 'rgb(70 45 12 / .1)');
  gg.addColorStop(1, 'rgb(70 45 12 / 0)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, 0, W, H);
  const gf = ctx.createLinearGradient(fore, 0, side === 'r' ? W - u * .25 : u * .25, 0);
  gf.addColorStop(0, 'rgb(70 45 12 / .1)');
  gf.addColorStop(1, 'rgb(70 45 12 / 0)');
  ctx.fillStyle = gf;
  ctx.fillRect(0, 0, W, H);
}

/* 这一页要用到的字：画之前先把字形分包取回来，canvas 不会自己去取 */
export function textOf(sp: Spread) {
  return sp.cells.map(x => x[2]).join('') + sp.mei.map(x => x[1]).join('') + (sp.back ?? []).map(x => x[2]).join('');
}

/* 书叶摞起来的边：压在这一页底下的每一叶都比上一叶往书口、书根错出一点点，错得不齐。
   从上往下看只露出几道发丝细的纸边，到中缝那头叶子都钉进书脊，边也收没了。
   t 是这一摞露出的宽度（CSS 像素）。画布比页面往外、往下各大出 M。 */
export const EDGE_M = 9;
export function drawEdge(cv: HTMLCanvasElement, g: Geom, dpr: number, side: Side, t: number) {
  const M = EDGE_M, W = g.W + M, H = g.H + M;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const r = rng(side === 'l' ? 41 : 43);
  const n = Math.max(2, Math.round(t * 1.6));
  /* 页面左上角在画布里的位置；书口朝外 */
  const px = side === 'l' ? M : 0;
  const out = side === 'l' ? -1 : 1;
  for (let i = n; i >= 1; i--) {
    const k = i / n;
    const dx = t * k * .62 + (r() - .5) * .5, dy = t * k + (r() - .5) * .45;
    /* 书口一边：整条错出；书根一边：从书口往中缝慢慢收到零 */
    const fore = side === 'l' ? px + dx * out : px + g.W + dx * out;
    const gut = side === 'l' ? px + g.W : px;
    const tone = 222 - k * 22 + (r() - .5) * 8;
    ctx.fillStyle = `rgb(${tone} ${tone - 16} ${tone - 50})`;
    ctx.beginPath();
    ctx.moveTo(gut, 0);
    ctx.lineTo(fore, dy * .15);
    ctx.lineTo(fore, g.H + dy);
    ctx.bezierCurveTo(fore + (gut - fore) * .45, g.H + dy, gut + (fore - gut) * .1, g.H + dy * .35, gut, g.H);
    ctx.closePath();
    ctx.fill();
    /* 每叶的边沿一道细线 */
    ctx.strokeStyle = `rgb(110 82 45 / ${.1 + .14 * k})`;
    ctx.lineWidth = .6;
    ctx.beginPath();
    ctx.moveTo(fore, dy * .15 + 2);
    ctx.lineTo(fore, g.H + dy);
    ctx.bezierCurveTo(fore + (gut - fore) * .45, g.H + dy, gut + (fore - gut) * .1, g.H + dy * .35, gut, g.H);
    ctx.stroke();
  }
}
