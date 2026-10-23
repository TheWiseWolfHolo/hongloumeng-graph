# 齐伋体的字形是从刻本扫描里一个个抠出来的，少数字带着上下邻字的残笔（比如“珍”下面多出一截）。
# 这里把整块落在字面框外的轮廓、贴着边的小墨点和碎屑删掉，另存一份干净的字体给 fonts.mjs 用。
# 用法 python scripts/qiji-clean.py <源字体> <输出字体> [对照图.png]
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

src, dst = sys.argv[1], sys.argv[2]
sheet = sys.argv[3] if len(sys.argv) > 3 else None
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


fixed = []
cmap = font.getBestCmap()
names = {}
for cp, n in cmap.items():
    names.setdefault(n, cp)
for name, cp in names.items():
    if not (0x3400 <= cp <= 0x9fff):
        continue
    parts = split(name)
    if len(parts) < 2:
        continue
    keep = [p for p in parts if not stray(bbox(p))]
    if len(keep) == len(parts) or not keep:
        continue
    pen = TTGlyphPen(gs)
    for ops in keep:
        for op, args in ops:
            getattr(pen, op)(*args)
    glyf[name] = pen.glyph()
    fixed.append(chr(cp))
font.save(dst)
print('cleaned', len(fixed))
print(''.join(fixed))

if sheet:
    from PIL import Image, ImageDraw, ImageFont
    a, b = ImageFont.truetype(src, 56), ImageFont.truetype(dst, 56)
    cols = 24
    rows = (len(fixed) + cols - 1) // cols
    im = Image.new('RGB', (cols * 70, rows * 140), 'white')
    d = ImageDraw.Draw(im)
    for i, c in enumerate(fixed):
        x, y = (i % cols) * 70, (i // cols) * 140
        d.text((x + 6, y + 4), c, font=a, fill='black')
        d.text((x + 6, y + 72), c, font=b, fill=(150, 30, 30))
    im.save(sheet)
