# Viral Video Starter

A production-ready template for launching a **photo-to-video template site**: visitors pick a
ready-made scene, upload one to three photos, and get a share-ready video with music. Video
generation runs on Seedance through [APIMart](https://apimart.ai); everything else — accounts,
credits, Stripe billing, admin, i18n, SEO — is built in.

> 中文功能介绍见下方 [功能一览](#功能一览)。部署指南见 [SETUP.zh-CN.md](./SETUP.zh-CN.md)。从爆款原片做成深度图模板见 **[复合爆款视频制作手册](./docs/viral-template-playbook.zh-CN.md)**。

## Features

### For your users

- **Home page** — hero, template showcase, how it works, feature highlights, use cases,
  pricing and FAQ.
- **Template gallery** — every template on one page, with hover-to-preview clips.
- **A landing page per template** — description, photo requirements, length, format, price,
  steps and FAQ, with the create form built in.
- **Video generation**
  - Upload 1–3 photos; each photo plays one person in the scene (some templates take pets).
  - Two versions: **Fast** (cheaper, up to 15 s) and **Premium** (full length, up to 1080p).
  - 480p / 720p / 1080p, with the exact credit price shown before generating.
  - Photo review → render → music added automatically, with live progress and time left.
  - Leave the page while it renders; a browser notification says when it's done.
  - Failed renders refund their credits automatically.
  - Download the MP4 or share to TikTok, Instagram Reels and YouTube Shorts.
- **Account and credits**
  - Sign in with an email code; Google, GitHub and Apple can be switched on.
  - My videos: every render in one place.
  - One-time credit packs (sample prices: $9.99 / $29.99 / $69.99) and a full credit history.
  - A discounted first full video for new accounts.
- **Everywhere** — English, 简体中文 and 日本語; dark (default) and light themes; works on
  phones and installs as an app (PWA).

### For admins

- **Users** — search, ban/unban, change roles, add or remove credits.
- **Paid users** — who bought which packs, plus revenue by first-touch source.
- **Audit log** — every admin action is recorded.

### For you, the operator

- **Viral template playbook** — how to pick a trend, make a Liblib depth-map clip, write the
  prompt, review user photos before render, and price the template:
  **[docs/viral-template-playbook.zh-CN.md](./docs/viral-template-playbook.zh-CN.md)** (中文).
- **Add a template by editing three files** — its page, the gallery, pricing and the sitemap
  update on their own.
- **Safety nets** — a 15-minute cron finishes or refunds stuck renders; low APIMart balance
  emails the admin; uploaded photos are deleted after 30 days.
- **Abuse protection** — disposable-email blocking, one signup grant per IP / device, rate
  limits and Turnstile on email sign-in.
- **SEO built in** — per-page titles and descriptions, sitemap, robots.txt, llms.txt, JSON-LD,
  OG image and an MDX blog.
- **Easy to deploy** — web and API both run on Cloudflare Workers (D1 + R2), with setup guides
  in English and Chinese and `pnpm check:placeholders` to list anything you still need to
  replace.

### Under the hood

- Generation runs on Seedance (2.5 and 2.0 fast) through APIMart, using the asset library so
  real faces pass review.
- Renders stay silent at the provider; the template's music is muxed in the browser without
  re-encoding.
- Stripe credit checkout (Creem and Waffo also supported) with idempotent webhooks and refunds.

## 功能一览

### 用户端

- **首页**：大标题、模板展示、使用步骤、卖点、适用人群、价格、常见问题。
- **模板列表**：所有模板一屏浏览，鼠标悬停即可预览视频。
- **每个模板一个详情页**：介绍、照片要求、时长画幅、价格、步骤和常见问题，页面里直接上传生成。
- **生成视频**
  - 上传 1～3 张照片，每张照片扮演场景里的一个人（部分模板支持宠物）。
  - 两个版本：**快速版**（便宜，最长 15 秒）和 **高级版**（完整时长，最高 1080p）。
  - 480p / 720p / 1080p 可选，生成前显示准确积分价格。
  - 照片审核 → 生成视频 → 自动配乐，实时显示进度和剩余时间。
  - 生成时可以离开页面，完成后浏览器通知。
  - 生成失败自动退还积分。
  - 下载 MP4，或一键分享到 TikTok、Instagram Reels、YouTube Shorts。
- **账号与积分**
  - 邮箱验证码登录，可开启 Google、GitHub、Apple 登录。
  - 「我的视频」查看全部生成记录。
  - 一次性积分包（示例价 $9.99 / $29.99 / $69.99），完整的积分流水。
  - 新用户首个完整视频享优惠价。
- **通用**：中文、英文、日文三语；深色（默认）/ 浅色主题；手机可用，可安装到桌面（PWA）。

### 管理员后台

- **用户管理**：搜索、封禁 / 解封、修改角色、加减积分。
- **付费用户**：谁买了哪些积分包，以及按来源渠道统计的收入。
- **操作记录**：管理员的每一次操作都有记录。

### 站长省心

- **复合爆款制作手册**：[docs/viral-template-playbook.zh-CN.md](./docs/viral-template-playbook.zh-CN.md) — 选片、Liblib 深度动作视频、提示词、照片审核、定价。
- **加模板只改 3 个文件**：详情页、模板列表、价格、网站地图自动更新。
- **自动兜底**：每 15 分钟处理卡住的生成（完成或退款）；APIMart 余额不足邮件提醒；用户照片 30 天后自动删除。
- **防薅羊毛**：拦截一次性邮箱，同一 IP / 设备只能领一次赠送积分，邮箱登录有频率限制和人机验证。
- **SEO 已做好**：每页标题描述、网站地图、robots.txt、llms.txt、结构化数据、分享图、MDX 博客。
- **部署简单**：前后端都跑在 Cloudflare Workers（D1 + R2），附中英文部署指南，`pnpm check:placeholders` 一键找出还没替换的占位内容。

## Stack

React 19 · TanStack Start/Router/Query · Tailwind CSS 4 · shadcn/ui (Base UI) · Hono · oRPC ·
Drizzle ORM · Cloudflare Workers, D1, R2 · Better Auth · Stripe · Turborepo · pnpm

## Quick start

```bash
pnpm install
cp apps/server/.dev.vars.example apps/server/.dev.vars       # set BETTER_AUTH_SECRET, APIMART_API_KEY
cp apps/web/.env.development.example apps/web/.env.development
pnpm db:migrate:local
pnpm dev:web+server                                           # web :3000, api :3001
```

Open http://localhost:3000. Then follow **[SETUP.md](./SETUP.md)** to brand the site, add your
templates, connect Stripe and deploy. To turn a viral clip into a template, follow
**[复合爆款视频制作手册](./docs/viral-template-playbook.zh-CN.md)**.

## Docs

| Guide | What it covers |
| --- | --- |
| [SETUP.md](./SETUP.md) | Brand, templates, Cloudflare, Stripe, deploy |
| [SETUP.zh-CN.md](./SETUP.zh-CN.md) | 同上，中文 |
| **[复合爆款视频制作手册](./docs/viral-template-playbook.zh-CN.md)** | 选爆款 → Liblib 深度动作视频 → 写提示词 → 照片素材库审核 → 提交生成 → 定价 |

## Project layout

```
apps/
  web/        TanStack Start site and dashboard (Cloudflare Worker)
  server/     Hono API, auth, credits, payments, video pipeline (Cloudflare Worker + D1 + R2)
packages/
  app-config/ Product config: app info, auth methods, credit packs, prices, video templates
  i18n/       Messages for web and server (en / zh / jp)
  ui/         Shared UI components and design tokens
  shared/     Cross-package utilities
  api-client/ Typed oRPC client
docs/
  viral-template-playbook.zh-CN.md   复合爆款视频制作手册（选片、深度图、提示词、审核、定价）
scripts/
  check-placeholders.mjs   Lists placeholders still to replace; flags committed secrets
```

## Common commands

| Command                         | What it does                               |
| ------------------------------- | ------------------------------------------ |
| `pnpm dev:web+server`           | Run web and API locally                    |
| `pnpm check-types`              | Type-check every package                   |
| `pnpm lint` / `pnpm fmt`        | oxlint / oxfmt                             |
| `pnpm test`                     | Run all test suites                        |
| `pnpm db:generate`              | Create a migration after changing a schema |
| `pnpm check:placeholders`       | Show placeholders left before you deploy   |
| `pnpm -F server dev:last-email` | Print the latest local sign-in code        |
| `pnpm deploy`                   | Deploy API then web to Cloudflare          |

## License

Commercial template. See the license terms you received with your purchase.
