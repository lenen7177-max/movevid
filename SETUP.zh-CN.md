# 部署指南（中文）

从拿到代码到网站上线。任何时候都可以运行 `pnpm check:placeholders`，查看还有哪些占位符没替换。

## 1. 准备

- Node.js 22+、pnpm 10（`corepack enable`）
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

| 变量                      | 说明                                                     |
| ------------------------- | -------------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | 任意 32 位以上随机字符串（`openssl rand -hex 32`）       |
| `APIMART_API_KEY`         | APIMart 的 API Key                                       |
| `TEMPLATE_MEDIA_BASE_URL` | 模板素材桶的公开地址（见第 5 步）                        |

```bash
pnpm db:migrate:local
pnpm dev:web+server
```

前端 http://localhost:3000，API http://localhost:3001。如果 42069 端口被其他项目的 TanStack devtools 占用，用 `DEVTOOLS_PORT=42169` 启动前端。

## 3. 品牌替换

| 内容                         | 位置                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| 产品名、客服邮箱、官网、社媒 | `packages/app-config/src/app-config.ts` → `common.app`               |
| 发件域名                     | `packages/app-config/src/app-config.ts` → `common.email.from`        |
| 配色、圆角、字体             | `packages/ui/src/styles/theme.css`（`--primary`、`--ring`、`.dark`） |
| Logo                         | `apps/web/src/components/logos/svg/logo.tsx`、`apps/web/public/logo.svg` |
| 网站图标、PWA 图标           | `apps/web/public/favicon*.ico`、`apps/web/public/pwa/*`              |
| PWA 名称和颜色               | `apps/web/public/manifest.webmanifest`                               |
| 分享图（OG）                 | `apps/web/public/og/og.png`（1200 × 630）                            |
| 全站文案                     | `packages/i18n/src/messages/web/{en,zh,jp}.json` → `video`           |
| 隐私政策、服务条款           | 同上 → `legal`（请按你所在地区法律审核）                             |
| 登录方式                     | `packages/app-config/src/app-config.ts` → `common.auth.methods`      |

默认深色主题，访客可以切换浅色。

## 4. 模板

每个模板由三部分组成，id 必须一致：

1. **画幅和价格**：`packages/app-config/src/video.ts`，在 `VIDEO_TEMPLATE_IDS` 加 id，在 `videoTemplates` 写画幅、时长、照片槽、可选的 `minPhotos`、`allowsPets`、`highlightSeconds`（超过 15 秒时给 Seedance 2.0 用的精华片段）和各画质的 `creditsCost`。
2. **参考素材和提示词**：`apps/server/src/video/templates.ts`，用 `buildReferencePrompt` 写角色、场景和逐镜时间轴，时间点要和参考视频的剪辑点对齐。
3. **文案和展示素材**：`packages/i18n/src/messages/web/*.json` → `video.templates.<id>`（名称、一句话介绍、描述、关键词、话题标签、每个照片槽的 `<slot>Role`），以及 `apps/web/src/lib/video/templates.ts`（封面、预览视频、可选的示例结果）。

模板详情页（`/templates/<id 用短横线>`）、模板列表、工作台、sitemap 和 llms.txt 会自动更新。`pnpm -F @repo/app-config test` 检查每个模板的毛利率，`pnpm -F server test` 检查提示词长度不超过 Seedance 上限。

自带的三个模板（双人舞、聚光灯独秀、慢动作走来）是可运行的示例，封面是占位图，上线前请换成你自己的场景。

### 参考视频

Seedance 会复刻参考视频的动作、站位和镜头。深度图视频（如用 Video Depth Anything 生成）效果好，因为只保留动作、不带原人物外貌；这类素材在提示词配置里设 `depthReference: true`。请只使用你有版权的素材。

## 5. 素材桶

建一个**公开**的 R2 桶（或任意 CDN），按下面的结构上传：

```
templates/<id>/reference.mp4             发给 Seedance 的参考视频（≤ 30 秒）
templates/<id>/soundtrack.m4a            从 0 秒对齐的 AAC 配乐
templates/<id>/reference-highlight.mp4   ≤ 15 秒的精华片段（有 highlightSeconds 的模板）
templates/<id>/soundtrack-highlight.m4a  对应的配乐片段
templates/<id>/preview.mp4               卡片和首屏用的静音循环预览（可选）
templates/<id>/poster.jpg                卡片封面（可选，/public 里有占位图）
```

把桶地址填到 `TEMPLATE_MEDIA_BASE_URL`（服务端）和 `VITE_TEMPLATE_MEDIA_BASE_URL`（前端）。配乐需有可随生成视频分发的授权。

另需一个**私有** R2 桶（`STORAGE` 绑定）保存用户照片和生成的视频。

## 6. 定价

`packages/app-config/src/app-config.ts`：

- `webCreditPackages`：每个积分包的积分数、展示价格、Stripe 价格 ID（测试和正式各一个）。
- `web.payments.plans`：Pro 订阅价格。
- `creditSignupGrant`：新用户赠送积分（默认关闭）。

`packages/app-config/src/video.ts` → `videoConfig`：默认积分价格、首个视频优惠、Pro 每月积分。定价测试（`packages/app-config/src/__tests__/video-pricing.test.ts`）里写着 APIMart 的每秒单价，价格变了记得更新。

在 Stripe 为每个积分包建一个一次性 Price，为 Pro 建两个订阅 Price，把 ID 填回去。添加 Webhook：`https://api.<你的域名>/api/webhooks/stripe`，勾选 checkout、invoice、subscription、payment intent 相关事件，签名密钥填到 `STRIPE_WEBHOOK_SECRET`。

## 7. Cloudflare 资源

```bash
npx wrangler d1 create your-project-db          # 把 database_id 填进 apps/server/wrangler.jsonc
npx wrangler r2 bucket create your-project-bucket
npx wrangler r2 bucket create your-project-media # 设为公开
```

然后修改：

- `apps/server/wrangler.jsonc`：Worker 名、D1 名称和 id、桶名、`WEBSITE_URL`、`SERVER_URL`、`GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID`、`TEMPLATE_MEDIA_BASE_URL`。
- `apps/web/wrangler.jsonc`：Worker 名、自定义域名、`API_SERVICE`（必须等于服务端 Worker 名）、各 `VITE_*`、Turnstile site key。
- 为域名开启 Cloudflare 邮件服务（或把 `common.email.provider` 改成 `resend` 并设置 `RESEND_API_KEY`）。

## 8. 部署

```bash
cp apps/server/.env.production.example apps/server/.env.production   # 填写密钥
pnpm -F server secrets:bulk:production
pnpm db:migrate
pnpm deploy
```

`api.<你的域名>` 指向服务端 Worker，`<你的域名>` 指向前端 Worker（`wrangler.jsonc` 里的自定义域名会在部署时自动绑定）。设置 `ADMIN_EMAIL`，该账号首次验证登录后自动获得管理员权限。

## 9. 上线前检查

- [ ] `pnpm check:placeholders` 没有遗漏需要替换的内容
- [ ] 模板已换成你自己的参考视频、配乐、封面和预览
- [ ] Stripe 已切到正式模式、填了正式价格 ID，Webhook 能收到事件
- [ ] 跑通一次生成：配乐能播放，人为制造失败时积分能退回
- [ ] 隐私政策和服务条款已按当地法律审核
- [ ] 可选：`VITE_GA_MEASUREMENT_ID`、Tawk.to 客服、`INDEXNOW_KEY` 搜索引擎推送
