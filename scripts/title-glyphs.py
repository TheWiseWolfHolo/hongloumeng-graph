# 题签用字的字形与笔顺：首页“紅樓夢”和各页页名。字形取齐伋体（明代闵刻本，OFL），笔顺取 Make Me a Hanzi 的中线（Arphic PL）。
# 两套字的位置不完全一样，把每个字的中线按包围盒对到齐伋体的字形上，前端用中线做遮罩，一笔一笔把刻本字露出来。
# 用法 python scripts/title-glyphs.py <qiji-combo.ttf> <笔顺 json 所在目录>，输出 src/data/title-glyphs.json。
import json, sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

font, sdir = sys.argv[1], sys.argv[2]
f = TTFont(font)
gs, cmap = f.getGlyphSet(), f.getBestCmap()
upm = f['head'].unitsPerEm
S = 1024 / upm
TITLES = ['紅樓夢', '人物譜', '金陵十二釵', '賈府世系', '四大家族', '情緣', '風波', '大觀園', '一百二十回', '大事眉批', '凡例', '關係']
out = {}
for ch in dict.fromkeys(''.join(TITLES)):
    name = cmap[ord(ch)]
    pen = SVGPathPen(gs, lambda v: f'{v:.0f}')
    gs[name].draw(pen)
    bp = BoundsPen(gs); gs[name].draw(bp)
    x0, y0, x1, y1 = bp.bounds
    asc = f['hhea'].ascent
    # 字形翻成 y 向下、1024 见方
    gb = (x0 * S, (asc - y1) * S, x1 * S, (asc - y0) * S)
    meds = json.load(open(os.path.join(sdir, ch + '.json'), encoding='utf8'))['medians']
    pts = [(x, 900 - y) for m in meds for x, y in m]
    mx0, my0 = min(p[0] for p in pts), min(p[1] for p in pts)
    mx1, my1 = max(p[0] for p in pts), max(p[1] for p in pts)
    fit = lambda x, y: (round(gb[0] + (x - mx0) / (mx1 - mx0) * (gb[2] - gb[0])), round(gb[1] + (900 - y - my0) / (my1 - my0) * (gb[3] - gb[1])))
    out[ch] = ({
        'glyph': pen.getCommands(),
        'tf': f'scale({S:.5f} {-S:.5f}) translate(0 {-asc})',
        'w': round(f['hmtx'][name][0] * S),
        'h': round((asc - f['hhea'].descent) * S),
        'medians': [' '.join(f'{x},{y}' for x, y in (fit(*p) for p in m)) for m in meds],
    })
json.dump(out, open(os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'title-glyphs.json'), 'w', encoding='utf8'), ensure_ascii=False)
print(len(out), 'chars', 'upm', upm)
