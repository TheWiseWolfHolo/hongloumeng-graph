# 齐伋体的字形是从刻本扫描里一个个抠出来的，少数字带着上下邻字的残笔（比如“珍”下面多出一截）。
# 这里把整块落在字面框外的轮廓、贴着边的小墨点和碎屑删掉，另存一份干净的字体给 fonts.mjs 用。
# 扫描字形大小也不匀：刻工写的字本来有大有小，抠图时又没统一，混排时一行里忽大忽小。
# 拿同一作者配套的 qiji-fallback（规整的仿刻本字）做尺子，把每个字缩放、挪正到统一的字面里。
# 用法 python scripts/qiji-clean.py <源字体> <输出字体> <qiji.ttf> <qiji-fallback.ttf> [对照图.png]
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

src, dst, pure_path, ref_path = sys.argv[1:5]
sheet = sys.argv[5] if len(sys.argv) > 5 else None
pure_cmap = TTFont(pure_path).getBestCmap()
ref = TTFont(ref_path)
ref_cmap, ref_gs = ref.getBestCmap(), ref.getGlyphSet()
# 扫描字比尺子宽约 24%、高约 7%，重心偏左 16、偏上 18（全站用字的中位数），统一到这个比例上，保留齐伋体本来的字面
KW, KH, DX, DY = 1.24, 1.07, -16, 18
font = TTFont(src)
glyf = font['glyf']
gs = font.getGlyphSet()
# 正常字身大致落在这个框里（字体单位，1000 一个字宽）
CORE = (95, -125, 885, 725)
INNER = (125, -95, 860, 700)


def split(name):
    rp = RecordingPen()
    gs[name].draw(rp)
    cur, out = [], []
    for op, args in rp.value:
        cur.append((op, args))
        if op in ('closePath', 'endPath'):
            out.append(cur)
            cur = []
    return out


def bbox(ops):
    pts = [p for _, args in ops for p in args if p is not None]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def stray(b):
    x0, y0, x1, y1 = b
    if y1 < CORE[1] or y0 > CORE[3] or x1 < CORE[0] or x0 > CORE[2]:
        return True
    # 扫描留下的碎屑，真的点画没有这么小
    if (x1 - x0) < 28 and (y1 - y0) < 28:
        return True
    # 贴边的小墨点
    small = (x1 - x0) < 45 and (y1 - y0) < 45
    return small and (y1 < INNER[1] or y0 > INNER[3] or x1 < INNER[0] or x0 > INNER[2])


def bounds(gset, name):
    bp = BoundsPen(gset)
    gset[name].draw(bp)
    return bp.bounds


def redraw(name, parts, m):
    pen = TTGlyphPen(gs)
    tp = TransformPen(pen, m) if m else pen
    for ops in parts:
        for op, args in ops:
            getattr(tp, op)(*args)
    glyf[name] = pen.glyph()


fixed = []
sized = 0
cmap = font.getBestCmap()
names = {}
for cp, n in cmap.items():
    names.setdefault(n, cp)
for name, cp in names.items():
    if not (0x3400 <= cp <= 0x9fff) or cp not in ref_cmap:
        continue
    parts = split(name)
    if not parts:
        continue
    keep = [p for p in parts if not stray(bbox(p))] or parts
    if len(keep) < len(parts):
        fixed.append(chr(cp))
    a = bounds(gs, name) if len(keep) == len(parts) else None
    if a is None:
        pts = [bbox(p) for p in keep]
        a = (min(b[0] for b in pts), min(b[1] for b in pts), max(b[2] for b in pts), max(b[3] for b in pts))
    r = bounds(ref_gs, ref_cmap[cp])
    if not a or not r:
        continue
    aw, ah = max(1, a[2] - a[0]), max(1, a[3] - a[1])
    rw, rh = max(1, r[2] - r[0]), max(1, r[3] - r[1])
    if cp in pure_cmap:
        k = ((KW * rw / aw) * (KH * rh / ah)) ** .5
        k = min(1.2, max(.84, k))
    else:
        # 刻本里没有的字用的是尺子本身，按同样比例放大
        k = (KW * KH) ** .5
    acx, acy = (a[0] + a[2]) / 2, (a[1] + a[3]) / 2
    tcx, tcy = (r[0] + r[2]) / 2 + DX, (r[1] + r[3]) / 2 + DY
    redraw(name, keep, (k, 0, 0, k, tcx - k * acx, tcy - k * acy))
    sized += 1
font.save(dst)
print('cleaned', len(fixed), 'sized', sized)

if sheet:
    from PIL import Image, ImageDraw, ImageFont
    a, b = ImageFont.truetype(src, 56), ImageFont.truetype(dst, 56)
    fixed = list('却说雨村忙回头看时不是别人乃是当日同僚一案参革的号张如圭者他本系此地人一么的說玉寶珍呈赴')
    cols = 24
    rows = (len(fixed) + cols - 1) // cols
    im = Image.new('RGB', (cols * 70, rows * 140), 'white')
    d = ImageDraw.Draw(im)
    for i, c in enumerate(fixed):
        x, y = (i % cols) * 70, (i // cols) * 140
        d.text((x + 6, y + 4), c, font=a, fill='black')
        d.text((x + 6, y + 72), c, font=b, fill=(150, 30, 30))
    im.save(sheet)
