"""生成标签页图标，朱底方印上一个马善政毛笔楷的“红”字。

字形直接取成矢量路径写进 SVG，不靠访问者电脑上的字体；另出两张 PNG 给不认 SVG 图标的浏览器和 iPhone 桌面。
字体用 build-site.py 下载到 .fonts-cache/ 的那份，先跑过一次 build-site.py 再跑本脚本。
用法 python tools/make-icons.py
"""
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / '.fonts-cache' / 'MaShanZheng-Regular.ttf'
OUT = ROOT / 'img'
RED, PAPER = '#a8271d', '#f6e7cf'
CH = '红'


def glyph_path(box):
    """把字缩放进 box=(x, y, w, h) 并居中，返回 SVG path 的 d。"""
    font = TTFont(FONT)
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord(CH)]
    bp = BoundsPen(gs)
    gs[name].draw(bp)
    x0, y0, x1, y1 = bp.bounds
    bx, by, bw, bh = box
    k = min(bw / (x1 - x0), bh / (y1 - y0))
    ox = bx + (bw - (x1 - x0) * k) / 2 - x0 * k
    oy = by + (bh - (y1 - y0) * k) / 2 + y1 * k
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.1f}'.rstrip('0').rstrip('.'))
    gs[name].draw(TransformPen(pen, (k, 0, 0, -k, ox, oy)))
    return pen.getCommands()


def png(size, radius, inset):
    """先画四倍大再缩小，边缘才干净；radius 为 0 时是整块方形，留给 iPhone 自己切圆角。"""
    s = size * 4
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=radius * 4, fill=RED)
    font = ImageFont.truetype(str(FONT), 100)
    l, t, r, b = d.textbbox((0, 0), CH, font=font)
    box = s * (1 - 2 * inset)
    font = ImageFont.truetype(str(FONT), int(100 * box / max(r - l, b - t)))
    l, t, r, b = d.textbbox((0, 0), CH, font=font)
    d.text(((s - (r - l)) / 2 - l, (s - (b - t)) / 2 - t), CH, font=font, fill=PAPER)
    return im.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="{RED}"/>'
           f'<path fill="{PAPER}" d="{glyph_path((8, 7, 48, 50))}"/></svg>\n')
    (OUT / 'icon.svg').write_text(svg, encoding='utf-8')
    png(32, 5, .12).save(OUT / 'icon-32.png', optimize=True)
    png(180, 0, .16).save(OUT / 'icon-180.png', optimize=True)
    for f in ('icon.svg', 'icon-32.png', 'icon-180.png'):
        print(f, (OUT / f).stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
