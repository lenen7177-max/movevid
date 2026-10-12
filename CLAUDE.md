# CLAUDE.md

Guidance for AI coding agents working in this repository.

## Overview

A photo-to-video template site. Users pick a template, upload 1–3 photos and get a short video
with music. Monorepo:

- `apps/web` — React 19 + TanStack Start site and dashboard, deployed as a Cloudflare Worker
- `apps/server` — Hono API on Cloudflare Workers with D1 (Drizzle) and R2
- `packages/app-config` — product configuration (app info, auth methods, credit packs, prices,
  video templates in `video.ts`)
- `packages/i18n` — messages for web and server (`en`, `zh`, `jp`)
- `packages/ui` — shared shadcn/ui (Base UI) components and theme tokens
- `packages/shared`, `packages/api-client` — utilities and the typed oRPC client

## Key flows

- **Video pipeline** (`apps/server/src/video/`): `createVideoJob` stores photos in R2, charges
  credits, uploads photos to APIMart and submits Seedance asset-library review; `syncVideoJob`
  (client polling + 15-minute cron) submits the render once photos pass, polls status, copies
  the output to R2, and refunds credits on any failure. Template media and prompts live in
  `templates.ts`; template shapes and prices in `packages/app-config/src/video.ts`.
- **Soundtrack**: renders are silent; the browser muxes the template soundtrack
  (`apps/web/src/lib/video/mux-soundtrack.ts`, served by `/api/video/soundtrack`).
- **Credits & payments**: `apps/server/src/credits/` (ledger) and `apps/server/src/payments/`
  (Stripe, Creem, Waffo). Packs and prices are configured in
  `packages/app-config/src/app-config.ts`.
- **API**: oRPC routers in `apps/server/src/routers/`; the web client is typed from
  `@server/routers`.

## Commands

```bash
pnpm dev:web+server      # web :3000, api :3001
pnpm check-types         # all packages (server builds declarations the web app reads)
pnpm lint / pnpm fmt     # oxlint / oxfmt
pnpm test                # all test suites
pnpm db:generate         # migration after a schema change; pnpm db:migrate:local to apply
pnpm check:placeholders  # template placeholders still to replace
```

## Conventions

- Copy goes in `packages/i18n/src/messages/web/{en,zh,jp}.json`; keep all three in sync.
- Web routes are file-based under `apps/web/src/routes/`; `routeTree.gen.ts` is generated.
- Template pages live at `/templates/$slug` (slug = template id with dashes).
- Design tokens are in `packages/ui/src/styles/theme.css`; dark is the default theme. Use the
  `.eyebrow`, `.display`, `.hero-glow` and `.dot-grid` utilities from
  `apps/web/src/styles/index.css` for marketing sections.
- Use oxfmt/oxlint, not ESLint/Prettier. React Compiler is enabled.
- Never commit `.dev.vars`, `.env.development` or `.env.production`; only the `.example` files.
