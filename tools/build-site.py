"""构建线上版到 dist/。

和 `node build.mjs` 生成的 index.html 只差字体:本地版引 Google Fonts,方便直接打开预览;
线上版改成自托管子集,因为大陆访问不到 fonts.googleapis.com,样式表还会卡住首屏。
子集按页面里实际出现的字生成,文案或数据改了重跑即可。字体源文件第一次运行时
从 Google Fonts 的 GitHub 仓库下载到 .fonts-cache/,之后复用。
依赖 node、fonttools 与 brotli。
"""
import hashlib
import io
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path
from urllib.parse import unquote

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
CACHE = ROOT / '.fonts-cache'
RAW = 'https://github.com/google/fonts/raw/main/ofl/'
FONTS = [
    # CSS 里的字体族名, google/fonts 里的路径, 字重范围, 输出文件名前缀
    ('Noto Serif SC', 'notoserifsc/NotoSerifSC%5Bwght%5D.ttf', '200 900', 'serif'),
    ('Noto Sans SC', 'notosanssc/NotoSansSC%5Bwght%5D.ttf', '100 900', 'sans'),
    ('Ma Shan Zheng', 'mashanzheng/MaShanZheng-Regular.ttf', '400', 'brush'),
]
GOOGLE = re.compile(
    r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\n'
    r'<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\n'
    r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]+">\n')
HEADERS = """/fonts/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *

/img/*
  Cache-Control: public, max-age=604800

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
"""


def fetch(rel):
    CACHE.mkdir(exist_ok=True)
    dst = CACHE / unquote(rel.rsplit('/', 1)[-1])
    if not dst.exists():
        print(f'下载 {dst.name}')
        tmp = dst.with_suffix('.part')
        with urllib.request.urlopen(RAW + rel, timeout=180) as r, open(tmp, 'wb') as f:
            shutil.copyfileobj(r, f)
        tmp.replace(dst)
    return dst


def main():
    subprocess.run(['node', str(ROOT / 'build.mjs')], check=True)
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    if len(GOOGLE.findall(html)) != 1:
        sys.exit('没找到 Google Fonts 那三行引用,build.mjs 的 head 可能改过,先对一下')

    extra = '，。、：；！？“”‘’（）《》〈〉【】—…·　'
    chars = {c for c in html if ord(c) > 0x7f} | {chr(i) for i in range(0x20, 0x7f)} | set(extra)
    unicodes = sorted(ord(c) for c in chars)

    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / 'fonts').mkdir(parents=True)
    faces, preload = [], ''
    for family, rel, weight, prefix in FONTS:
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.hinting = False
        opts.ignore_missing_unicodes = True
        font = subset.load_font(str(fetch(rel)), opts)
        cmap = font.getBestCmap()
        missing = sum(1 for u in unicodes if u > 0x7f and u not in cmap)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=unicodes)
        sub.subset(font)
        buf = io.BytesIO()
        subset.save_font(font, buf, opts)
        data = buf.getvalue()
        name = f'{prefix}-{hashlib.sha256(data).hexdigest()[:10]}.woff2'
        (DIST / 'fonts' / name).write_bytes(data)
        faces.append(f"@font-face{{font-family:'{family}';src:url(/fonts/{name}) format('woff2');"
                     f"font-weight:{weight};font-style:normal;font-display:swap}}")
        if prefix == 'serif':
            preload = f'<link rel="preload" href="/fonts/{name}" as="font" type="font/woff2" crossorigin>\n'
        print(f'{family}: {len(data) / 1024:.0f} KB,缺字 {missing} 个(由后备字体补)')

    html = GOOGLE.sub(lambda _: preload + '<style>\n' + '\n'.join(faces) + '\n</style>\n', html)
    (DIST / 'index.html').write_text(html, encoding='utf-8')
    (DIST / '_headers').write_text(HEADERS, encoding='utf-8')
    shutil.copytree(ROOT / 'img', DIST / 'img')
    print(f'dist/index.html {len(html.encode()) / 1024:.0f} KB,用到 {len(unicodes)} 个字符')


if __name__ == '__main__':
    main()
