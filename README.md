# Viral Video Starter

A production-ready template for launching a **photo-to-video template site**: visitors pick a
ready-made scene, upload one to three photos, and get a share-ready video with music. Video
generation runs on Seedance through [APIMart](https://apimart.ai); everything else — accounts,
credits, Stripe billing, admin, i18n, SEO — is built in.

> 中文说明见 [SETUP.zh-CN.md](./SETUP.zh-CN.md)。

## What you get

- **Template engine** — each template is a reference clip + prompt + soundtrack. Add one by
  editing three files; pages, pricing, sitemap and studio pick it up automatically.
- **Generation pipeline** — photo upload and validation, Seedance asset-library review,
  render submission, polling, automatic refunds on failure, cron safety net, low-balance
  email alerts, 30-day photo cleanup.
- **Two versions per template** — Premium (Seedance 2.5, full length, up to 1080p) and Fast
  (Seedance 2.0 fast, ≤15 s highlight cut), each priced in credits per quality.
- **In-browser soundtrack muxing** — renders stay silent at the provider; the template's music
  is added client-side with no re-encode.
- **Credits & billing** — one-time credit packs on Stripe (Creem and Waffo also supported),
  first-video offer, signup grant with anti-abuse checks, automatic refunds.
- **Accounts** — Better Auth with email OTP, email/password, Google, GitHub, Apple; Turnstile
  and per-IP / per-address rate limits on email routes.
- **Marketing site** — home, template gallery, a landing page per template, pricing, blog
  (MDX), legal pages, sitemap, robots.txt, llms.txt, JSON-LD, OG image, PWA.
- **Dashboard** — my videos, credit purchases and history, user and paid-user admin, audit log.
- **i18n** — English, 简体中文, 日本語.
- **Edge-native** — web (TanStack Start) and API (Hono) both deploy to Cloudflare Workers with
  D1 and R2.

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
templates, connect Stripe and deploy.

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
scripts/
  check-placeholders.mjs   Lists placeholders still to replace; flags committed secrets
```

## Common commands

| Command                    | What it does                                       |
| -------------------------- | -------------------------------------------------- |
| `pnpm dev:web+server`      | Run web and API locally                            |
| `pnpm check-types`         | Type-check every package                           |
| `pnpm lint` / `pnpm fmt`   | oxlint / oxfmt                                     |
| `pnpm test`                | Run all test suites                                |
| `pnpm db:generate`         | Create a migration after changing a schema         |
| `pnpm check:placeholders`  | Show placeholders left before you deploy           |
| `pnpm deploy`              | Deploy API then web to Cloudflare                  |

## License

Commercial template. See the license terms you received with your purchase.
