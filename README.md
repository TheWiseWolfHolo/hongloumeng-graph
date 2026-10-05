# 红楼梦人物关系图谱

《红楼梦》人物关系的单页网站，线上地址 https://honglou.wolfholo.com 。

阅读版按入卷、人物、关系、园中和回目组织导航。人物栏目包括人物谱和金陵十二钗，关系栏目保留星图、世系、四大家族与情缘。首页提供人物搜索、三条故事入口和最近看过的人物。

网站使用原生 JS 和 SVG，最后合成一个 HTML 文件。人物搜索支持姓名、别称与简介关键词。人物链接使用 `#index?person=林黛玉`，原有 `#graph`、`#twelve` 等地址继续有效。

结局和判词解读默认收起，可以逐项展开，也能用页首按钮更改默认状态。这个开关不屏蔽简介、关系与回目里的全部情节。主题、展开偏好与最近阅读记录仅保存在当前浏览器；首页可以清除阅读记录。

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
| `catalog.js` | 人物别称、统一搜索和具名数据对象 |
| `core.js` | 工具函数、主题切换、人物抽屉、页签 |
| `reading.js` | 入卷页、阅读偏好、人物地址与分享 |
| `graph.js` | 关系星图，含全景、命盘、关系链三种模式 |
| `tree.js` / `pages.js` / `garden.js` / `timeline.js` | 其余各页签 |
| `main.js` | 启动与全局点击委托 |
| `style.css` / `reading.css` / `body.html` | 原有图形样式、阅读版排版与页面骨架 |

本地生成的 `index.html` 引用 Google Fonts，只用来预览，不进仓库。

`img/12/` 存放正册、副册与又副册的画像。正册沿用 640×960 的 WebP；香菱、晴雯、袭人使用作者提供的原始 PNG。页面按相对路径引用，线上构建会整个拷进 `dist/`。画像用于阅读配图，不作服饰与场景考证。

`img/icon.svg`、`img/icon-32.png`、`img/icon-180.png` 是标签页和手机桌面的图标，由 `tools/make-icons.py` 从马善政毛笔楷里取“红”字生成，字形写成矢量路径，不靠访问者电脑上的字体。

## 数据约定

- 人物以名字作 id，`EDGES`、`EVENTS` 的 `ids`、大观园院落的 `who` 里出现的名字都要在 `NODES` 里有。
- 关系称谓写成 `p/q` 时，表示甲是乙的 p、乙是甲的 q。星图悬停连线会把它念成「乙 是 甲 的 q」，所以两边都要能这样念通；双方对称的关系只写一个词，比如「兄弟」「结怨」。
- `EVENTS` 按回目先后排，第八十回以后的情节属于续书，正文里注明。
- 中文文字一律用全角标点，引号用“”。
- 大观园院落的 `ev` 填的是事件标题，必须和 `EVENTS` 里的 `t` 一字不差。

## 上线

推到 `main` 分支后，GitHub Actions 自动构建并部署到 Cloudflare Pages 项目 `hongloumeng`，最后再抓一次线上页面检查内容和字体文件。流程在 `.github/workflows/deploy.yml`，也能在 Actions 页面手动触发。

部署需要仓库 Secrets 里的两项。

| 名称 | 值 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 只有 Cloudflare Pages 编辑权限的 API token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |

两项缺任何一项，Actions 就只构建和检查，不部署。fork 出去的仓库读不到这两项，所以别人的 fork 不会动到线上。

想在本地出一份和线上一样的构建，需要 Python 3 和 `pip install fonttools brotli`。

```sh
python tools/build-site.py          # 输出到 dist/
python tools/check-html.py dist/index.html
```

### 字体

线上版不引 Google Fonts，因为大陆访问不到，样式表还会拖住首屏。`tools/build-site.py` 把思源宋体、思源黑体和马善政毛笔楷按页面里实际出现的字切成子集，自托管在 `/fonts/`，三个文件合计约 1.9 MB。字体源文件第一次构建时从 [google/fonts](https://github.com/google/fonts) 下载到 `.fonts-cache/`，三款都是 OFL 授权。

子集每次构建都会按当前文案重切，新加的字不会掉回系统字体。马善政体本身缺 8 个字，这几个字由后备字体显示。

## 改完怎么验

先运行项目自带检查。

```sh
node tools/check-data.mjs
node build.mjs
python tools/check-html.py index.html
```

数据检查覆盖人物和关系引用、回目范围、院落事件引用与常用别称搜索。

- 在首页输入“宝二爷”，用方向键和回车打开贾宝玉。搜索没有结果时可以清除条件。
- 复制人物链接，在新标签页打开，确认直接显示对应人物。浏览器前进、后退应恢复页签和人物。
- 关闭人物详情后，它应退出焦点顺序；打开画像后，Esc 关闭并回到原按钮。星图节点支持方向键切换和回车打开。
- “林黛玉＋后四十回”应显示当前筛选中的 1 件大事，并说明全部收录 17 件。

- 浅色、深色主题各看一眼。
- 把视口调到 390px 宽，在控制台确认 `document.documentElement.scrollWidth === document.documentElement.clientWidth`，五个主栏目和下层页签都点一遍，页面不能横向滚动。
- 星图要用触屏模拟再试一遍。手机上页面里的星图只是预览，轻点进入全屏；全屏里点人开关卡片、双击进命盘、拖动人物卡片、返回键退出全屏都要走通。
- 控制台没有报错。

## 许可

代码与整理的人物资料按 [MIT](LICENSE) 发布。构建时下载的三款字体各自遵循 SIL Open Font License。
