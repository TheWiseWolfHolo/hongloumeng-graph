# 红楼梦人物关系图谱

《红楼梦》的人物、关系与一百二十回原文，线上地址 https://honglou.wolfholo.com 。

前八十回用《脂砚斋重评石头记》，正文里带着各本脂批；后四十回用程甲本，站里处处标明是续书，统计只算前八十回。

| 栏目 | 页面 |
|---|---|
| 卷首 | 首页：搜索、今日一回、朱批一则、十二钗、人物出场的水墨河流图 |
| 人物 | 人物谱、每人一页（出场分布、脂批、亲友、结局分三层写）、金陵十二钗判词册 |
| 关系 | 关系星图（圆盘全景与命盘）、贾府世系、四大家族、情缘与风波 |
| 大观园 | 手绘园图，院落住户与旧事，第十七回游园 |
| 回目 | 一百二十回目录与原文阅读页、大事眉批 |

结局、判词解说默认遮住，点开才看。阅读进度、主题和阅读偏好只存在访问者自己的浏览器里。

## 本地改

需要 Node 24（直接运行 `.ts`）、Python 3 和 `pip install fonttools brotli`。

```sh
npm install
npm run dev        # 本地预览 http://localhost:4321
npm run build      # 统计 → 切字体 → 出站 → 自检，输出到 dist/
```

| 位置 | 内容 |
|---|---|
| `src/data/people.ts` | 分组、人物（`end` 前八十回已写到的结局，`fate` 判词与脂批透露的原意，`xu` 续书写法） |
| `src/data/relations.ts` | 关系 `EDGES` |
| `src/data/events.ts` | 大事 |
| `src/data/garden.ts` | 大观园院落、景致与游园路线 |
| `src/data/loves.ts`、`families.ts`、`lineage.ts`、`twelve.ts` | 情缘与风波、四大家族、世系、十二钗 |
| `src/data/text/` | 一百二十回原文，一回一个 JSON，脂批挂在正文的字位上 |
| `src/data/derived/` | `npm run stats` 算出来的出场次数、同场人物和每人的脂批 |
| `src/lib/` | 数据汇总、原文渲染、星图与世系的布局计算 |
| `src/pages/` | 各页面 |
| `scripts/` | 抓原文、算统计、切字体、构建后自检 |

### 原文

`npm run text` 从维基文库下载原文到 `.text-cache/`，解析成 `src/data/text/`。前八十回取《脂硯齋重評石頭記》，批语模板 `{{~|…}}` 解析成挂在字位上的注；后四十回取程甲本。全部用 OpenCC 转成简体。原文已经提交在仓库里，平时不用重跑。

### 字体

线上不引 Google Fonts。`scripts/fonts.mjs` 收集 `src/` 里实际出现的字，把思源宋体、霞鹜文楷和马善政毛笔楷裁成子集，再切成按 unicode-range 分包的 woff2，输出到 `public/fonts/`。用到的字没变时直接跳过。字体源文件第一次运行时下载到 `.fonts-cache/`。

## 数据约定

- 人物以名字作 id。关系、大事、院落住户里出现的名字都要在人物表里有。
- 关系称谓写成 `p/q` 时，表示甲是乙的 p、乙是甲的 q；双方对称的只写一个词。
- 涉及结局时分三层：前八十回写到的、原意（注明出处，判词、伏笔或哪一本的脂批）、续书。原意不确定时照实说。
- 第八十回以后的情节都标“续书”。
- 中文一律用全角标点，引号用“”。

## 上线

推到 `main` 后，GitHub Actions 跑 `npm run build`，通过自检才部署到 Cloudflare Pages 项目 `hongloumeng`，最后抓几页线上页面再核一遍。流程在 `.github/workflows/deploy.yml`。

部署需要仓库 Secrets 里的 `CLOUDFLARE_API_TOKEN`（只给 Pages 编辑权限）和 `CLOUDFLARE_ACCOUNT_ID`。缺任何一项就只构建不部署，fork 出去的仓库读不到这两项。

## 改完怎么验

`npm run build` 最后一步是 `scripts/check-site.mjs`，检查主要页面和关键文字都在、所有站内链接都指向存在的页面。另外手动看一眼：

- 浅色、深色主题。
- 390px 宽的手机视口，页面不能横向滚动。
- 关系星图：停在名字上高亮亲友，点人进命盘，再点别人换中心，Esc 回到全景；关系链查“刘姥姥”到“林黛玉”。
- 阅读页切换脂批的三种显示方式，左右方向键翻回。

## 许可

代码与整理的人物资料按 [MIT](LICENSE) 发布。原文取自维基文库。字体各自遵循 SIL Open Font License。
