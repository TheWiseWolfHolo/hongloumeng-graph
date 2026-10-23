# 生成一张可平铺的竹纸纹理：极淡的深浅、细长的纤维、帘纹。纸屑和斑点由页面按页随机加，每页不同。
# 输出接近白色的灰度图，页面上用 multiply 叠在纸色上，深色模式也不受影响。
# 用法 python scripts/paper-texture.py public/textures/zhuzhi.webp
import random
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 512
out = sys.argv[1]
rnd = random.Random(1791)  # 程甲本刊行那年


def tile3(im):
    big = Image.new(im.mode, (im.width * 3, im.height * 3))
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * im.width, j * im.height))
    return big


def cloud(cells, amp):
    """低频的深浅：随机小图放大再取中间一块，保证四边接得上"""
    small = Image.new('L', (cells, cells))
    small.putdata([rnd.randint(128 - amp, 128 + amp) for _ in range(cells * cells)])
    big = tile3(small).resize((S * 3, S * 3), Image.BICUBIC)
    return big.crop((S, S, 2 * S, 2 * S))


base = Image.new('L', (S, S), 128)
for cells, amp in ((4, 26), (12, 14), (40, 8)):
    base = ImageChops.add(base, cloud(cells, amp), scale=1, offset=-128)
base = base.filter(ImageFilter.GaussianBlur(2))

# 纤维：细而长的弯线，颜色比纸略深，少数略亮
fib = Image.new('L', (S * 3, S * 3), 0)
d = ImageDraw.Draw(fib)
for _ in range(700):
    x, y = rnd.uniform(0, S), rnd.uniform(0, S)
    ang = rnd.gauss(0.15, 0.5)  # 竹纸纤维大多顺着帘纹方向
    length = rnd.uniform(10, 60)
    pts = []
    for k in range(7):
        t = k / 6
        pts.append((x + t * length * (1 if k else 0) + rnd.uniform(-.5, .5), y + t * length * ang + rnd.uniform(-.5, .5)))
    v = rnd.randint(6, 15)
    for ox in (0, S, 2 * S):
        for oy in (0, S, 2 * S):
            d.line([(px + ox, py + oy) for px, py in pts], fill=v, width=1)
fib = fib.crop((S, S, 2 * S, 2 * S)).filter(ImageFilter.GaussianBlur(.45))

# 帘纹：抄纸时竹帘留下的横向细纹，极淡
lian = Image.new('L', (S, S), 0)
dl = ImageDraw.Draw(lian)
for y in range(0, S, 4):
    dl.line([(0, y), (S, y)], fill=3)
for x in range(0, S, 64):
    dl.line([(x, 0), (x, S)], fill=4)
lian = lian.filter(ImageFilter.GaussianBlur(.8))

# 纸屑与小斑点
spk = Image.new('L', (S * 3, S * 3), 0)
ds = ImageDraw.Draw(spk)
for _ in range(0):
    x, y, r = rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(.5, 1.6)
    v = rnd.randint(18, 50)
    for ox in (0, S, 2 * S):
        for oy in (0, S, 2 * S):
            ds.ellipse([x + ox - r, y + oy - r, x + ox + r, y + oy + r], fill=v)
spk = spk.crop((S, S, 2 * S, 2 * S)).filter(ImageFilter.GaussianBlur(.6))

# 合成：以 255 为白，往下减
img = Image.new('L', (S, S), 255)
img = ImageChops.subtract(img, ImageChops.invert(base).point(lambda v: max(0, v - 118) * .16))
img = ImageChops.subtract(img, fib)
img = ImageChops.subtract(img, lian)
img = ImageChops.subtract(img, spk)
img.convert('RGB').save(out, quality=86, method=6)
print(out, img.getextrema())
