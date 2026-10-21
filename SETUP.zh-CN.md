# 部署指南（中文）

从拿到代码到网站上线。任何时候都可以运行 `pnpm check:placeholders`，查看还有哪些占位符没替换、哪些模板自带的 Logo / 分享图 / 图标、示例模板和示例文章还没换掉或删掉、`site.config.jsonc` 里哪些值不合法、生成文件是否过期。它是部署前的关卡：有任何一项就 exit 1，`pnpm deploy:server` 和 `pnpm deploy:web` 会先跑它，不通过就不部署。

## 0. 起一个新站：要改的所有地方

每个新站都从这个仓库复制。按下面的清单逐项改完，再看后面各节的细节。改完 `pnpm check:placeholders` 应该通过（exit 0）。

**站点身份和 Cloudflare 配置：只改 `site.config.jsonc`**

- [ ] 根目录 `site.config.jsonc`，每项都有注释：
  - 站点名 `name`、域名 `domain`、素材桶地址 `mediaUrl`，可选 `supportEmail`、`shortName`、`socialUrls`（社媒主页 https 链接，用于 Organization JSON-LD 的 sameAs 和页脚，留空则不显示）
  - Worker 名 `cloudflare.webWorker` / `serverWorker`
  - D1 名称和 id `d1DatabaseName` / `d1DatabaseId`
  - R2 桶名 `r2Bucket`
  - 限流 id `rateLimitNamespaceIds`
  - Turnstile site key `turnstileSiteKey`
  - 发信方式 `emailProvider`（必填）：`resend` 或 `cloudflare`。模板填的是 `resend`；有这个设置之前做的站用的是 `cloudflare`
  - 可选的公开 ID `public.*`：OAuth client ID、GA、OpenPanel、Tawk.to、APIMart 素材组。填了 `googleClientId` / `githubClientId` 就自动开启 Google / GitHub 登录，同时要在 `apps/server/.env.production` 里填 `GOOGLE_CLIENT_SECRET` / `GITHUB_CLIENT_SECRET` 并上传为 Worker 密钥
- [ ] 限流 id 是正整数。**同一个 Cloudflare 账号内每个站都必须唯一**，两个限流器之间也不能相同；重复的话几个站会共用同一个计数器，互相限流。建议按站编号分配，例如第 3 个站用 `3001`、`3002`
- [ ] 改完运行 `pnpm site:sync`，它会重新生成下面这些文件。不要手改它们，`pnpm check:placeholders` 会把手改或忘了同步的文件报成过期：
  - `apps/server/wrangler.jsonc`：Worker 名、`api.<域名>` 路由、D1、R2、限流 id、`WEBSITE_URL` / `SERVER_URL` 等
  - `apps/web/wrangler.jsonc`：Worker 名、`<域名>` 和 `www.<域名>` 路由、`API_SERVICE`、各 `VITE_*`
  - `apps/web/public/manifest.webmanifest`：PWA 名称（其余字段如颜色照常在这个文件里改）
  - `packages/app-config/src/site.generated.json`：产品名、域名、客服邮箱，app-config 从这里读，发件域名也用它
- [ ] 绑定、cron、兼容日期这类所有站共用的设置在 `apps/*/wrangler.template.jsonc` 里改，再 `pnpm site:sync`

**品牌素材**

- [ ] Logo、图标、分享图：`apps/web/src/components/logos/svg/logo.tsx`、`apps/web/public/logo.svg`、`favicon*.ico`、`pwa/*`、`og/og.png`（1200 × 630）
- [ ] 配色和字体：`packages/ui/src/styles/theme.css`

**模板**（见第 4 节）

- [ ] `packages/app-config/src/video.ts`：`VIDEO_TEMPLATE_IDS`、`videoTemplates`（含固定的上线日期 `launchDate`）
- [ ] `apps/server/src/video/templates.ts`：参考视频、配乐、提示词
- [ ] `apps/web/src/lib/video/templates.ts`：封面、预览、示例成片、视频墙 `samples`（3–6 条）
- [ ] `packages/i18n/src/messages/web/en.json` → `video.templates.<id>`：名称、介绍、关键词，以及可选的 `seoTitle`、`h1`、`faq`、`trend`、`samples`
- [ ] 删掉不用的示例模板（`duo_dance`、`solo_spotlight`、`squad_walk`）：上面四处一起删，再删 `apps/web/public/templates/<id>/` 和它配对的示例教程文章（`apps/web/content/blog/en/how-to-make-<slug>.mdx`，如 `how-to-make-duo-dance.mdx`）。只剩 1 个模板时首页自动变成该模板的落地页
- [ ] 素材桶上传参考视频、配乐、预览和样片（第 5 节）

**文案与内容**

- [ ] `packages/i18n/src/messages/web/en.json` → `video`：首页、定价、FAQ 等全站文案；→ `legal`：隐私政策和服务条款（按当地法律审核）。站点只开英文，`zh.json`、`jp.json` 不用改
- [ ] `apps/web/content/blog/en/`：替换示例文章（`date` 写成 `YYYY-MM-DD`；文章有实质改动时可加 `updated: "YYYY-MM-DD"`，不能早于 `date`，结构化数据的 dateModified 和网站地图 lastmod 会用它。只改日期、没改内容时不要动它），`content/author/en/team.mdx` 改成你的作者；改完跑 `pnpm -F web blog:validate`
- [ ] 每个模板配一篇教程：`content/blog/en/how-to-make-<模板 slug>.mdx`，frontmatter 写 `template: <模板 id>`（骨架在 `docs/how-to-guide-template.mdx`，数字用 `<TemplateValue>` / `<TemplateFacts>` 从配置读）。模板页会出现「Read the full guide」卡片，文章顶部和底部会链接回模板页；没有教程的模板 `blog:validate` 只警告

**支付与密钥**

- [ ] `packages/app-config/src/app-config.ts` → `webCreditPackages`：6 个 `price_*_PLACEHOLDER` 换成 Stripe 测试 / 正式价格 ID
- [ ] Stripe Webhook：`https://api.<你的域名>/api/webhooks/stripe`
- [ ] `apps/server/.env.production`（从 `.env.production.example` 复制）：`BETTER_AUTH_SECRET`、`ADMIN_EMAIL`、`APIMART_API_KEY`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`TURNSTILE_SECRET_KEY` 等，再 `pnpm -F server secrets:bulk:production`

**SEO 与收录**

- [ ] `INDEXNOW_KEY`：在部署的 shell / CI 里设置（或写进 `apps/web/.env.production`），见第 8 节；每次部署后会提交 `apps/web/indexnow-sent.json`，记得推送
- [ ] Cloudflare 控制台 → 你的域名 → AI 爬虫控制（AI Crawl Control）：新域名默认可能会拦截 AI 爬虫，按需放行；如果开了「托管 robots.txt」，它会覆盖本站的 robots.txt
- [ ] 可选：`VITE_GA_MEASUREMENT_ID`、Tawk.to 客服

## 1. 准备

- Node.js 22.18+、pnpm 10（`corepack enable`）
- Cloudflare 账号（Workers、D1、R2、邮件服务、Turnstile）
- [APIMart](https://apimart.ai) 账号并充值，用于 Seedance 视频生成
- Stripe 账号（也支持 Creem / Waffo）

## 2. 本地运行

```bash
pnpm install
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp apps/web/.env.development.example apps/web/.env.development
```

`apps/server/.dev.vars` 至少填写：

| 变量                      | 说明                                               |
| ------------------------- | -------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | 任意 32 位以上随机字符串（`openssl rand -hex 32`） |
| `APIMART_API_KEY`         | APIMart 的 API Key                                 |
| `TEMPLATE_MEDIA_BASE_URL` | 模板素材桶的公开地址（见第 5 步）                  |

```bash
pnpm db:migrate:local
pnpm dev:web+server
```

前端 http://localhost:3000，API http://localhost:3001。本地不会真的发邮件：在登录页点「发送验证码」后，运行 `pnpm -F server dev:last-email` 即可看到验证码。如果 42069 端口被其他项目的 TanStack devtools 占用，用 `DEVTOOLS_PORT=42169` 启动前端。

## 3. 品牌替换

| 内容                             | 位置                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| 产品名、域名、客服邮箱           | `site.config.jsonc`（再 `pnpm site:sync`）                               |
| 发件地址                         | `noreply@<domain>`；前缀在 `app-config.ts` → `common.email.from`         |
| 配色、圆角、字体                 | `packages/ui/src/styles/theme.css`（`--primary`、`--ring`、`.dark`）     |
| Logo                             | `apps/web/src/components/logos/svg/logo.tsx`、`apps/web/public/logo.svg` |
| 网站图标、PWA 图标               | `apps/web/public/favicon*.ico`、`apps/web/public/pwa/*`                  |
| PWA 颜色（名称来自 site.config） | `apps/web/public/manifest.webmanifest`                                   |
| 分享图（OG）                     | `apps/web/public/og/og.png`（1200 × 630）                                |
| 全站文案                         | `packages/i18n/src/messages/web/en.json` → `video`                       |
| 隐私政策、服务条款               | 同上 → `legal`（请按你所在地区法律审核）                                 |
| 登录方式                         | `packages/app-config/src/app-config.ts` → `common.auth.methods`          |

默认深色主题，访客可以切换浅色。

站点只开英文：语言切换、`/zh`、`/jp` 路由、sitemap 和 hreflang 都只有 en（旧的 `/zh/*`、`/jp/*` 链接 301 到英文页）。`zh.json`、`jp.json` 留在仓库里但不加载，新模板不用写。要重新开启某个语言，见 `packages/i18n/src/locales.ts` 顶部的步骤。

## 4. 模板

每个模板由三部分组成，id 必须一致：

1. **画幅和价格**：`packages/app-config/src/video.ts`，在 `VIDEO_TEMPLATE_IDS` 加 id，在 `videoTemplates` 写上线日期 `launchDate`（`YYYY-MM-DD`，写死，不随构建变化）、画幅、时长、照片槽、可选的 `minPhotos`、`allowsPets`、`highlightSeconds`（超过 15 秒时给 Seedance 2.0 用的精华片段）和各画质的 `creditsCost`。`launchDate` 就是结构化数据 VideoObject 的 `uploadDate` 和 sitemap 里该页的 `<lastmod>`。
2. **参考素材和提示词**：`apps/server/src/video/templates.ts`，用 `buildReferencePrompt` 写角色、场景和逐镜时间轴，时间点要和参考视频的剪辑点对齐。
3. **文案**：`packages/i18n/src/messages/web/en.json` → `video.templates.<id>`：名称、一句话介绍、描述、关键词、话题标签、每个照片槽的 `<slot>Role`。下面几项可选，不写就用 `video.templatePage` 里全站通用的那套（`duo_dance` 是写全了的例子）：
   - `seoTitle`：页面 `<title>`，默认「`{name} — AI video template | {appName}`」；`h1`：页面 H1，默认模板名。都建议以目标关键词开头。
   - `faq`：`[{ "q": "…", "a": "…" }]`，替换通用 FAQ（页面和 FAQPage 结构化数据都用它）。
   - `trend`：`{ "title": "…", "body": ["段落", "段落"] }`，「What is the {X} trend」段落；`title` 可省略，默认「What is the {name} trend?」。
   - `samples`：视频墙每条样片的标题，按顺序一条一个字符串。
   - `cta`：生成按钮文字，默认「Make my {name} video」，价格自动加在后面；`who`：「Who to make it of」卡片，结构同 `video.templatePage.who`，可只覆盖部分键。
   - 以上都可以用 `{name}`、`{appName}`、`{photos}`、`{seconds}`、`{aspect}`、`{credits}`、`{price}`（能买下最便宜一次渲染的最小充值包价格）。
4. **展示素材**：`apps/web/src/lib/video/templates.ts`：封面、预览视频、可选的示例结果 `sample`，以及视频墙 `samples`（3–6 条，类型上限制了数量，例如 `[1, 2, 3, 4].map((n) => sampleClip("<id>", n))`，对应素材桶里的 `templates/<id>/samples/<n>.mp4` 和 `<n>.jpg`）。每条样片输出一个 VideoObject，第一条有声成片作为 `og:video`。

模板详情页（`/templates/<id 用短横线>`）、模板列表、工作台、sitemap 和 llms.txt 会自动更新。`pnpm -F @repo/app-config test` 检查每个模板的毛利率和上线日期，`pnpm -F server test` 检查提示词长度不超过 Seedance 上限、照片数和 `@图片` 一致。测试会遍历所有模板 id，删掉示例模板不会挂。

**单模板站**：`VIDEO_TEMPLATE_IDS` 只剩 1 个时，首页 `/` 直接渲染这个模板的落地页（title 和 H1 用该模板的 `seoTitle` / `h1`，默认以模板名开头），canonical 是 `/`；`/templates` 和 `/templates/<slug>` 301 到 `/`，并从 sitemap 和导航里去掉，不会出现两个 URL 同一内容。

自带的三个模板（双人舞、聚光灯独秀、慢动作走来）是可运行的示例，封面是占位图，上线前请换成你自己的场景。

### 参考视频

Seedance 会复刻参考视频的动作、站位和镜头。不要把原片直接当参考视频发给模型（人脸和版权会进成片）。先用 Liblib / LibTV 的深度动作捕捉（或 Video Depth Anything）做成灰度深度图，只保留动作和场景；提示词配置里设 `depthReference: true`。用户照片必须先走 APIMart 素材库审核，明星、公众人物、政治人物会被拒。完整选片、写提示词、审核、提交和定价步骤见 **[复合爆款视频制作手册](./docs/viral-template-playbook.zh-CN.md)**。

## 5. 素材桶

建一个**公开**的 R2 桶（或任意 CDN），按下面的结构上传：

```
templates/<id>/reference.mp4             发给 Seedance 的参考视频（≤ 30 秒）
templates/<id>/soundtrack.m4a            从 0 秒对齐的 AAC 配乐
templates/<id>/reference-highlight.mp4   ≤ 15 秒的精华片段（有 highlightSeconds 的模板）
templates/<id>/soundtrack-highlight.m4a  对应的配乐片段
templates/<id>/preview.mp4               卡片和首屏用的静音循环预览（可选）
templates/<id>/poster.jpg                卡片封面（可选，/public 里有占位图）
templates/<id>/samples/<n>.mp4           视频墙样片（可选，3–6 条，带配乐）和封面 <n>.jpg
```

把桶地址填到 `site.config.jsonc` 的 `mediaUrl`，`pnpm site:sync` 会写进服务端的 `TEMPLATE_MEDIA_BASE_URL` 和前端的 `VITE_TEMPLATE_MEDIA_BASE_URL`。本地开发分别在 `apps/server/.dev.vars` 和 `apps/web/.env.development` 里设置。配乐需有可随生成视频分发的授权。

另需一个**私有** R2 桶（`STORAGE` 绑定）保存用户照片和生成的视频。

## 6. 定价

`packages/app-config/src/app-config.ts`：

- `webCreditPackages`：每个积分包的积分数、展示价格、Stripe 价格 ID（测试和正式各一个）。
- `creditSignupGrant`：新用户赠送积分（默认关闭）。

`packages/app-config/src/video.ts` → `videoConfig`：默认积分价格、首个视频优惠。定价测试（`packages/app-config/src/__tests__/video-pricing.test.ts`）里写着 APIMart 的每秒单价，价格变了记得更新。

在 Stripe 为每个积分包建一个一次性 Price，把 ID 填回去。添加 Webhook：`https://api.<你的域名>/api/webhooks/stripe`，勾选 `checkout.session.*`、`payment_intent.*` 和 `charge.refunded` 事件，签名密钥填到 `STRIPE_WEBHOOK_SECRET`。

## 7. Cloudflare 资源

```bash
npx wrangler d1 create <d1DatabaseName>          # 打印的 database_id 填进 site.config.jsonc
npx wrangler r2 bucket create <r2Bucket>
npx wrangler r2 bucket create <你的素材桶>        # 设为公开，地址填进 mediaUrl
```

然后：

- 把名称、id 填进 `site.config.jsonc` 的 `cloudflare` 段，运行 `pnpm site:sync`。两个 `wrangler.jsonc` 都由它生成：
  - API 路由是 `api.<domain>`，和 `SERVER_URL` 一致
  - 前端路由是 `<domain>` 和 `www.<domain>`
  - `API_SERVICE` 指向服务端 Worker
- `rateLimitNamespaceIds` 的两个 id：任意正整数，**同一个 Cloudflare 账号内每个站必须唯一**，两个之间也不能相同。同账号的两个站用了同一个 id，会共用一个限流计数器。`pnpm check:placeholders` 会检查它们是否还是占位符、是否为正整数、是否重复。
- 发信方式由 `site.config.jsonc` 的 `emailProvider` 决定（必填，模板填的是 `resend`）。用 `resend`：在 Resend 验证 `<domain>`，并设置 Worker 密钥 `RESEND_API_KEY`。改成 `cloudflare` 时为域名开启 Cloudflare 邮件服务，`pnpm site:sync` 会在 `apps/server/wrangler.jsonc` 里加上 `EMAIL` 的 `send_email` 绑定（用 Resend 时不生成）。

## 8. 部署

```bash
cp apps/server/.env.production.example apps/server/.env.production   # 填写密钥
pnpm -F server secrets:bulk:production -- --dry-run   # 只列出要上传的键名
pnpm -F server secrets:bulk:production
pnpm db:migrate
pnpm deploy:all
```

`secrets:bulk:production` 只上传有值的键，也不会上传 `pnpm db:migrate` 用的本地键 `CLOUDFLARE_*`；它只打印键名，不打印值。它不能交互，先运行 `npx wrangler login`；登录的账号下有多个 Cloudflare 账户时，用文件里的 `CLOUDFLARE_ACCOUNT_ID` 选定账户。

`pnpm deploy:all`（以及单独的 `pnpm deploy:server` / `pnpm deploy:web`）会先跑 `pnpm check:placeholders`，没通过就停下，不会构建也不会部署。注意别写成 `pnpm deploy`：那是 pnpm 自带的命令，不会跑这里的脚本。

`api.<你的域名>` 指向服务端 Worker，`<你的域名>` 指向前端 Worker，两边 `wrangler.jsonc` 里的 `routes` 自定义域名都会在部署时自动绑定。设置 `ADMIN_EMAIL`，该账号首次验证登录后自动获得管理员权限。

**IndexNow 推送**（Bing、Yandex 等，Bing 的索引也供 ChatGPT 搜索使用）：

- **准备 key：** 在 [Bing IndexNow](https://www.bing.com/indexnow/getstarted) 生成一个 key，部署前在 shell 或 CI 里 `export INDEXNOW_KEY=<key>`（也可以写进 `apps/web/.env.production`）。
- **key 文件：** 构建时自动生成 `apps/web/public/<key>.txt`，内容只有 key，换 key 时旧文件会被删掉。这个文件已在 `.gitignore` 里：32 位的 key 由 `.gitignore` 规则覆盖，其他长度的 key 由脚本写进本地的 `.git/info/exclude`。
- **只推新增或改动的页面，不看日期：**
  1. `wrangler deploy` 成功后，先等线上 `/api/pwa-version` 换成这次构建的版本号。
  2. 逐个抓取 sitemap 里的页面，对内容算哈希：标题、meta、JSON-LD、链接和正文；构建产生的资源文件名和脚本不算在内。
  3. 和 `apps/web/indexnow-sent.json` 里上次推过的哈希对比，只推新增或哈希变了的 URL。
  4. 推送成功后更新这个文件并自动提交一个 commit（`chore(indexnow): …`）。**记得推送这个 commit**，否则下次部署（尤其是 CI 上的全新 clone）会把所有页面当作新页面重推。
- **日志：** 部署日志里能看到 `[indexnow] submitted N URLs (HTTP 200)`（202 表示 key 还在验证，也算成功）。没有变化时显示 `no new or changed URLs`。
- **全量和预览：**
  - 全量推送：`pnpm -F web indexnow --all`。
  - 只看会推哪些、不发送也不写文件：`pnpm -F web indexnow --dry-run`。
- **失败处理：** 推送失败、抓不到页面、线上还没换成新版本时只打警告，不写记录，也不会让部署失败。

## 9. 上线前检查

- [ ] `pnpm check:placeholders` 通过（exit 0）
- [ ] 模板已换成你自己的参考视频、配乐、封面和预览
- [ ] Stripe 已切到正式模式、填了正式价格 ID，Webhook 能收到事件
- [ ] 跑通一次生成：配乐能播放，人为制造失败时积分能退回
- [ ] 隐私政策和服务条款已按当地法律审核
- [ ] 部署日志里有 `[indexnow] submitted N URLs (HTTP 200/202)`，`apps/web/indexnow-sent.json` 的提交已推送；`https://<你的域名>/robots.txt` 放行所有爬虫，`/sitemap.xml` 的 `<lastmod>` 是模板上线日期而不是今天
- [ ] Cloudflare 的 AI 爬虫控制没有拦截你想放行的爬虫
- [ ] 可选：`VITE_GA_MEASUREMENT_ID`、Tawk.to 客服
