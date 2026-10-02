# 红楼梦人物关系图谱

《红楼梦》人物关系的单页网站，线上地址 https://honglou.wolfholo.com 。

八个页签分别是关系星图、贾府世系、四大家族、金陵十二钗、情缘、大观园、百二十回大事和人物谱。不依赖任何前端库，全部是原生 JS 和 SVG，最后合成一个 HTML 文件。

## 本地改

```sh
node build.mjs          # 合成 index.html，直接用浏览器打开就能看
```

源码都在 `src/`，`build.mjs` 按固定顺序把它们拼起来，并先用 `node --check` 检查一遍语法。

| 文件 | 内容 |
|---|---|
| `data-people.js` | 分组、关系类型、人物 `NODES`、关系 `EDGES` |
| `data-extra.js` | 世系树、十二钗判词、四大家族、大观园院落与游园路线、情缘与恩怨 |
| `data-events.js` | 百二十回大事 `EVENTS` |
| `core.js` | 工具函数、主题切换、人物抽屉、页签 |
| `graph.js` | 关系星图，含全景、命盘、关系链三种模式 |
| `tree.js` / `pages.js` / `garden.js` / `timeline.js` | 其余各页签 |
| `main.js` | 启动与全局点击委托 |
| `style.css` / `body.html` | 样式与页面骨架 |

本地生成的 `index.html` 引用 Google Fonts，只用来预览，不进仓库。

## 数据约定

- 人物以名字作 id，`EDGES`、`EVENTS` 的 `ids`、大观园院落的 `who` 里出现的名字都要在 `NODES` 里有。
- 关系称谓写成 `p/q` 时，表示甲是乙的 p、乙是甲的 q。星图悬停连线会把它念成「乙 是 甲 的 q」，所以两边都要能这样念通；双方对称的关系只写一个词，比如「兄弟」「结怨」。
- `EVENTS` 按回目先后排，第八十回以后的情节属于续书，正文里注明。
- 大观园院落的 `ev` 填的是事件标题，必须和 `EVENTS` 里的 `t` 一字不差。

## 上线

在本机构建、本机部署，GitHub 只放源码。线上是 Cloudflare Pages 项目 `hongloumeng`，部署脚本在工作区的 `Deployments/hongloumeng/scripts/deploy.ps1`，它会调用下面的构建脚本，再用 wrangler 上传 `dist/` 并检查线上页面。

```sh
python tools/build-site.py          # 输出到 dist/，需要 Python 3 和 pip install fonttools brotli
python tools/check-html.py dist/index.html
```

部署脚本上传的是工作区当前内容，没提交的改动也会上线，所以习惯上先提交再部署。

### 字体

线上版不引 Google Fonts，因为大陆访问不到，样式表还会拖住首屏。`tools/build-site.py` 把思源宋体、思源黑体和马善政毛笔楷按页面里实际出现的字切成子集，自托管在 `/fonts/`，三个文件合计约 1.9 MB。字体源文件第一次构建时从 [google/fonts](https://github.com/google/fonts) 下载到 `.fonts-cache/`，三款都是 OFL 授权。

子集每次构建都会按当前文案重切，新加的字不会掉回系统字体。马善政体本身缺 8 个字，这几个字由后备字体显示。

## 改完怎么验

- 浅色、深色主题各看一眼。
- 把视口调到 390px 宽，在控制台确认 `document.documentElement.scrollWidth === document.documentElement.clientWidth`，八个页签都点一遍，页面不能横向滚动。
- 控制台没有报错。
