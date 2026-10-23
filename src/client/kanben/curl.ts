/* 翻页的那张纸用 WebGL 画：纸面是一张网格。线装书的叶子钉在书脊上，翻的时候中缝那一边不动，
   纸从中缝起整张弯成一道弧，越往书口越超前，书口的下角又领先一些，像手捏着书角往上掀。
   正面贴旧页，背面贴新页；按纸面朝向定明暗，底下两页靠中缝处落一点影子。 */

const VS = `
attribute vec2 a_uv;
uniform vec2 u_page;
uniform float u_s, u_A, u_B, u_C, u_F, u_zoff;
uniform vec2 u_origin, u_center, u_res;
varying vec2 v_uv;
varying float v_phi;
/* 纸上离中缝 s（按页宽计）处的倾角：整页转过 A，越往外越超前 B，下角再多领先 C */
float phi(float s, float yn) {
  return clamp(u_A + u_B * pow(s, 1.4) + u_C * yn * s, 0., 3.14159265);
}
void main() {
  float yn = a_uv.y;
  /* 沿着纸面从中缝积分过去，纸长不变，中缝那一边始终贴在书脊上 */
  float x = 0., z = 0.;
  float ds = a_uv.x / 24.;
  for (int k = 0; k < 24; k++) {
    float f = phi((float(k) + .5) * ds, yn);
    x += cos(f) * ds;
    z += sin(f) * ds;
  }
  x *= u_page.x;
  z *= u_page.x;
  vec2 w = vec2(u_origin.x + u_s * x, u_origin.y + yn * u_page.y);
  float k = u_F / (u_F - z);
  vec2 sc = u_center + (w - u_center) * k;
  gl_Position = vec4(sc.x / u_res.x * 2. - 1., 1. - sc.y / u_res.y * 2., -(z + u_zoff) / 4000., 1.);
  v_uv = a_uv;
  v_phi = phi(a_uv.x, yn);
}`;

const FS = `
precision highp float;
uniform sampler2D u_front, u_back;
uniform float u_s, u_flip;
varying vec2 v_uv;
varying float v_phi;
void main() {
  bool front = gl_FrontFacing == (u_flip < .5);
  float fx = u_s < 0. ? 1. - v_uv.x : v_uv.x;
  vec3 c;
  float l;
  if (front) {
    c = texture2D(u_front, vec2(fx, v_uv.y)).rgb;
    l = .58 + .42 * cos(v_phi - .3) + .08 * exp(-pow((v_phi - .55) / .3, 2.));
  } else {
    c = texture2D(u_back, vec2(1. - fx, v_uv.y)).rgb;
    l = .58 + .42 * cos(3.14159265 - v_phi - .3) + .06 * exp(-pow((v_phi - 2.55) / .3, 2.));
  }
  gl_FragColor = vec4(c * clamp(l, .35, 1.08), 1.);
}`;

/* 影子：铺满画布的一块，按到卷轴的距离算深浅 */
const SVS = `
attribute vec2 a_uv;
void main() { gl_Position = vec4(a_uv * 2. - 1., 0., 1.); }`;
const SFS = `
precision highp float;
uniform vec2 u_page, u_origin, u_resDev;
uniform float u_s, u_A, u_dpr;
void main() {
  vec2 px = vec2(gl_FragCoord.x, u_resDev.y - gl_FragCoord.y) / u_dpr;
  float p = u_s * (px.x - u_origin.x);
  float y = px.y - u_origin.y;
  float a = 0.;
  if (y > 0. && y < u_page.y && abs(p) < u_page.x) {
    /* 纸立起来时，两边书页靠中缝处都落一点影；翻过去之前影在原页，翻过去之后在另一页 */
    float lift = sin(u_A);
    float side = p > 0. ? 1. - u_A / 3.14159265 : u_A / 3.14159265;
    a = .3 * lift * side * exp(-abs(p) / (u_page.x * (.25 + .45 * lift)));
  }
  gl_FragColor = vec4(vec3(.11, .07, .02) * a, a);
}`;

export interface Leaf {
  start: number;
  dur: number;
  s: 1 | -1; // 翻起的那页在中缝哪一边：-1 左页，1 右页
  a0: number; // 下角领先多少
  front: TexImageSource;
  back: TexImageSource;
  land: () => void;
  /* 手拖时由指针给进度，松手后交还给时间 */
  manual?: number;
  tf?: WebGLTexture;
  tb?: WebGLTexture;
  e?: number;
  done?: boolean;
}

export class Curl {
  gl: WebGLRenderingContext;
  cv: HTMLCanvasElement;
  prog: WebGLProgram;
  sprog: WebGLProgram;
  buf: WebGLBuffer;
  ibuf: WebGLBuffer;
  quad: WebGLBuffer;
  count: number;
  leaves: Leaf[] = [];
  raf = 0;
  /* 页面几何：页宽高、中缝顶点在画布里的位置 */
  W = 0; H = 0; ox = 0; oy = 0; dpr = 1;
  onIdle: (() => void) | null = null;

  static create(cv: HTMLCanvasElement) {
    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return null;
    try { return new Curl(cv, gl); } catch (e) { console.warn('翻页动画不可用', e); return null; }
  }

  constructor(cv: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.cv = cv;
    this.gl = gl;
    const mk = (vs: string, fs: string) => {
      const p = gl.createProgram()!;
      for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
        gl.attachShader(p, sh);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
      return p;
    };
    this.prog = mk(VS, FS);
    this.sprog = mk(SVS, SFS);
    /* 网格：横向密一些，卷得圆 */
    const NX = 48, NY = 24;
    const uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) uv.push(i / NX, j / NY);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    this.count = idx.length;
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
    this.ibuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  }

  layout(W: number, H: number, ox: number, oy: number, cw: number, ch: number, dpr: number) {
    Object.assign(this, { W, H, ox, oy, dpr });
    this.cv.width = Math.round(cw * dpr);
    this.cv.height = Math.round(ch * dpr);
    this.cv.style.width = cw + 'px';
    this.cv.style.height = ch + 'px';
  }

  tex(src: TexImageSource) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    return t;
  }

  add(leaf: Leaf) {
    leaf.tf = this.tex(leaf.front);
    leaf.tb = this.tex(leaf.back);
    this.leaves.push(leaf);
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  /* 一张纸在进度 e（0 平放原处，1 平放另一边）时的弯法 */
  shape(l: Leaf, e: number) {
    const w = Math.sin(Math.PI * e);
    return { A: Math.PI * e, B: .95 * w, C: l.a0 * w * (1 - e) * 2 };
  }

  frame = (now: number) => {
    const gl = this.gl;
    gl.viewport(0, 0, this.cv.width, this.cv.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const ease = (t: number) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const live: { l: Leaf; e: number; i: number }[] = [];
    this.leaves.forEach((l, i) => {
      if (l.done) return;
      let e: number;
      if (l.manual != null) e = l.manual;
      else {
        const t = (now - l.start) / l.dur;
        if (t < 0) { e = 0; }
        else e = ease(Math.min(1, t));
      }
      l.e = e;
      live.push({ l, e, i });
    });
    /* 先画影子，再画纸 */
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.sprog);
    const sl = gl.getAttribLocation(this.sprog, 'a_uv');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(sl);
    gl.vertexAttribPointer(sl, 2, gl.FLOAT, false, 0, 0);
    const su = (n: string) => gl.getUniformLocation(this.sprog, n);
    for (const { l, e } of live) {
      if (e <= 0 || e >= 1) continue;
      gl.uniform2f(su('u_page'), this.W, this.H);
      gl.uniform2f(su('u_origin'), this.ox, this.oy);
      gl.uniform2f(su('u_resDev'), this.cv.width, this.cv.height);
      gl.uniform1f(su('u_s'), l.s);
      gl.uniform1f(su('u_A'), this.shape(l, e).A);
      gl.uniform1f(su('u_dpr'), this.dpr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(this.prog);
    const al = gl.getAttribLocation(this.prog, 'a_uv');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf);
    const u = (n: string) => gl.getUniformLocation(this.prog, n);
    gl.uniform1i(u('u_front'), 0);
    gl.uniform1i(u('u_back'), 1);
    /* 还没起翻的叶子只画最上面那一张，它压着底下的 */
    let waitingDrawn = false;
    for (const { l, e, i } of live) {
      if (e <= 0) { if (waitingDrawn) continue; waitingDrawn = true; }
      const { A, B, C } = this.shape(l, Math.max(0, e));
      gl.uniform2f(u('u_page'), this.W, this.H);
      gl.uniform1f(u('u_s'), l.s);
      gl.uniform1f(u('u_A'), A);
      gl.uniform1f(u('u_B'), B);
      gl.uniform1f(u('u_C'), C);
      gl.uniform1f(u('u_F'), 2600);
      /* 先起翻的叶子在原处时压在上面，落到另一边后被后来的压住 */
      gl.uniform1f(u('u_zoff'), (e > .5 ? 1 : -1) * i * .8);
      gl.uniform2f(u('u_origin'), this.ox, this.oy);
      gl.uniform2f(u('u_center'), this.ox, this.oy + this.H * .5);
      gl.uniform2f(u('u_res'), this.cv.width / this.dpr, this.cv.height / this.dpr);
      gl.uniform1f(u('u_flip'), l.s < 0 ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, l.tf!);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, l.tb!);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
    /* 落定的叶子交给底下的静止页面，这一帧之后不再画 */
    for (const { l, e } of live) {
      if (e >= 1 && l.manual == null) {
        l.done = true;
        l.land();
        gl.deleteTexture(l.tf!);
        gl.deleteTexture(l.tb!);
      }
    }
    this.leaves = this.leaves.filter(l => !l.done);
    if (this.leaves.length) this.raf = requestAnimationFrame(this.frame);
    else {
      this.raf = 0;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      this.onIdle?.();
    }
  };

  /* 手拖时每动一下都要重画一帧 */
  kick() { if (!this.raf) this.raf = requestAnimationFrame(this.frame); }

  cancel() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const leaf of this.leaves) {
      leaf.done = true;
      this.gl.deleteTexture(leaf.tf!);
      this.gl.deleteTexture(leaf.tb!);
    }
    this.leaves = [];
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  /* 松手：已过一半就翻过去，不到就落回原处 */
  release(l: Leaf, forward: boolean, onBack: () => void) {
    const from = l.manual ?? 0;
    const to = forward ? 1 : 0;
    const dur = 260 + Math.abs(to - from) * 700;
    const t0 = performance.now();
    const step = () => {
      if (l.done) return;
      const t = Math.min(1, (performance.now() - t0) / dur);
      const k = 1 - Math.pow(1 - t, 3);
      l.manual = from + (to - from) * k;
      if (t < 1) { this.kick(); requestAnimationFrame(step); return; }
      if (forward) { l.manual = undefined; l.start = -1e9; l.dur = 1; }
      else { l.done = true; this.gl.deleteTexture(l.tf!); this.gl.deleteTexture(l.tb!); onBack(); }
      this.kick();
    };
    requestAnimationFrame(step);
  }
}
