# Server

Hono + Cloudflare Workers + D1 API: auth, credits, payments and the video generation pipeline.

See the repository `SETUP.md` for the full first-time setup.

## Development

```bash
cp .dev.vars.example .dev.vars   # fill in BETTER_AUTH_SECRET and APIMART_API_KEY at least
pnpm run db:migrate:local        # create the local D1 database
pnpm run dev                     # http://localhost:3001
```

## Production

```bash
cp .env.production.example .env.production   # secrets only
pnpm run secrets:bulk:production -- --dry-run # list the key names it would upload
pnpm run secrets:bulk:production             # upload the non-empty ones to the worker
pnpm run db:migrate                          # apply migrations to the remote D1
pnpm deploy:server                           # from the repo root: deploy gate, then wrangler deploy
```

Public values (URLs, OAuth client IDs, `TEMPLATE_MEDIA_BASE_URL`) come from the root
`site.config.jsonc`; `pnpm site:sync` writes them into the generated `wrangler.jsonc` `vars`.
Do not put the same key in both `vars` and the secrets file.

## Layout

```
src/
├── index.ts             Hono app, webhooks, cron entry
├── video/               Template video pipeline (APIMart / Seedance)
│   ├── templates.ts     Per-template reference media + prompt   ← add templates here
│   ├── prompt-builder.ts Shared prompt structure
│   ├── service.ts       Create, poll, refund, cleanup
│   ├── apimart.ts       APIMart HTTP client
│   └── config.ts        Pipeline settings (timeouts, vision model, alerts)
├── routers/             oRPC routes (video, credits, payments, users, admin)
├── credits/             Credit ledger, grants, orders
├── payments/            Stripe, Creem and Waffo providers
├── db/schema/           Drizzle schemas; migrations in db/migrations
├── emails/              React Email templates
└── lib/                 Auth, RBAC, context, origin policy
```

## Scheduled jobs

`wrangler.jsonc` triggers two crons:

- every 15 minutes: finish or refund renders whose owners left the page, and email
  `ADMIN_EMAIL` when the APIMart balance is low;
- daily: expire free credits and delete uploaded photos older than 30 days.

## Administrator

Set `ADMIN_EMAIL` as a secret. After that account signs in with a verified email it is
granted the `admin` role automatically.

## Scripts

| Script                             | Description                                |
| ---------------------------------- | ------------------------------------------ |
| `pnpm run dev`                     | Local dev server (port 3001)               |
| `pnpm run test`                    | Vitest suites                              |
| `pnpm run db:generate`             | Generate a migration from schema changes   |
| `pnpm run db:migrate:local`        | Apply migrations to local D1               |
| `pnpm run db:migrate`              | Apply migrations to remote D1              |
| `pnpm run secrets:bulk:production` | Upload non-empty `.env.production` secrets |
| `pnpm run cf-typegen`              | Regenerate `worker-configuration.d.ts`     |
| `pnpm run email-preview`           | Preview email templates (port 4000)        |
