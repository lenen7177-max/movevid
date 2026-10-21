# Setup guide

From a fresh copy to a live site. Run `pnpm check:placeholders` at any point to see what is
left to replace, which `site.config.jsonc` values are malformed and whether the generated files
are stale. It is the deploy gate: it exits 1 while anything is left, and `pnpm deploy:server` /
`pnpm deploy:web` run it first and stop there.

## 0. One file per site: `site.config.jsonc`

Site identity and Cloudflare settings live in `site.config.jsonc` at the repo root (each field
is commented): name, domain, media bucket URL, worker names, D1 name and id, R2 bucket, the
two rate-limit namespace ids (positive integers, unique within your Cloudflare account and
different from each other), the Turnstile site key and optional public IDs (OAuth client IDs,
analytics, Tawk.to, APIMart asset group). After editing it run `pnpm site:sync`, which
rewrites `apps/server/wrangler.jsonc`, `apps/web/wrangler.jsonc` (from their
`wrangler.template.jsonc`), the PWA name in `apps/web/public/manifest.webmanifest` and
`packages/app-config/src/site.generated.json`. Never edit those by hand: the deploy gate
reports them as out of date. Shared settings (bindings, crons, compatibility date) belong in
the `wrangler.template.jsonc` files. The full new-site checklist is in
[SETUP.zh-CN.md § 0](./SETUP.zh-CN.md#0-起一个新站要改的所有地方).

## 1. Prerequisites

- Node.js 22.18+ and pnpm 10 (`corepack enable`)
- A Cloudflare account (Workers, D1, R2, Email Routing / Email Service, Turnstile)
- An [APIMart](https://apimart.ai) account with balance, for Seedance video generation
- A Stripe account (or Creem / Waffo)

## 2. Run it locally

```bash
pnpm install
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp apps/web/.env.development.example apps/web/.env.development
```

In `apps/server/.dev.vars` set at least:

| Key                       | Value                                                    |
| ------------------------- | -------------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | any random 32+ character string (`openssl rand -hex 32`) |
| `APIMART_API_KEY`         | your APIMart key                                         |
| `TEMPLATE_MEDIA_BASE_URL` | public URL of your template media bucket (see step 5)    |

```bash
pnpm db:migrate:local
pnpm dev:web+server
```

Web runs on http://localhost:3000, the API on http://localhost:3001. Local email is not
delivered: after requesting a sign-in code, run `pnpm -F server dev:last-email` to print it. If another project already
uses TanStack devtools on port 42069, start the web app with `DEVTOOLS_PORT=42169`.

## 3. Brand the site

| What                                         | Where                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Product name, domain, support email          | `site.config.jsonc` (then `pnpm site:sync`)                                    |
| Email sender                                 | `noreply@<domain>`; the local part is in `app-config.ts` → `common.email.from` |
| Colors, radius, fonts                        | `packages/ui/src/styles/theme.css` (`--primary`, `--ring`, `.dark`)            |
| Logo                                         | `apps/web/src/components/logos/svg/logo.tsx` and `apps/web/public/logo.svg`    |
| Favicons and PWA icons                       | `apps/web/public/favicon*.ico`, `apps/web/public/pwa/*`                        |
| PWA colors (the name comes from site.config) | `apps/web/public/manifest.webmanifest`                                         |
| Social share image                           | `apps/web/public/og/og.png` (1200 × 630)                                       |
| All page copy                                | `packages/i18n/src/messages/web/en.json` → `video`                             |
| Privacy policy and terms                     | same files → `legal` (review with your own counsel)                            |
| Sign-in methods                              | `packages/app-config/src/app-config.ts` → `common.auth.methods`                |

Dark is the default theme; visitors can switch to light.

The site serves English only: the language switcher, `/zh` and `/jp` routes, sitemap and
hreflang are en-only (old `/zh/*` and `/jp/*` links 301 to the English page). `zh.json` and
`jp.json` stay in the repo but are not loaded, so new copy only goes in `en.json`. To turn a
language back on, follow the steps at the top of `packages/i18n/src/locales.ts`.

The full new-site checklist (every file and setting to change) is in
[SETUP.zh-CN.md § 0](./SETUP.zh-CN.md#0-起一个新站要改的所有地方).

## 4. Templates

A template has three parts. The ids must match everywhere.

1. **Shape and price** — `packages/app-config/src/video.ts`
   Add the id to `VIDEO_TEMPLATE_IDS` and an entry to `videoTemplates`: a fixed `launchDate`
   (YYYY-MM-DD; the VideoObject `uploadDate` and the page's sitemap `<lastmod>`), aspect ratio,
   length, photo slots, optional `minPhotos`, `allowsPets`, `highlightSeconds` (for Seedance
   2.0 when the clip is longer than 15 s) and per-quality `creditsCost`.
2. **Reference media and prompt** — `apps/server/src/video/templates.ts`
   Describe the cast, the scene and the shot timeline with `buildReferencePrompt`. Keep the
   shot times aligned with the cuts in your reference clip.
3. **Copy and media** — `packages/i18n/src/messages/web/en.json` → `video.templates.<id>`
   (name, tagline, description, keywords, hashtag, one `<slot>Role` per photo slot) and
   `apps/web/src/lib/video/templates.ts` (poster, preview loop, optional sample render, and an
   optional video wall of 3–6 `samples`, each one a VideoObject). Optional per-template copy
   falls back to the shared `video.templatePage` copy when left out: `seoTitle`, `h1`, `faq`
   (`[{ q, a }]`), `trend` (`{ title?, body: [paragraphs] }`, the "What is the … trend"
   section) and `samples` (one caption per wall clip). `duo_dance` shows all of them.

The landing page (`/templates/<id-with-dashes>`), gallery, studio, sitemap and llms.txt update
on their own. With a single template, `/` becomes its landing page and `/templates/*`
redirects there. `pnpm -F @repo/app-config test` checks every template keeps your margin
target and has a valid launch date; `pnpm -F server test` checks every prompt stays under
Seedance's length limit. Both loop over every template id, so deleting the examples is safe.

The three shipped templates (Duo Dance, Solo Spotlight, Squad Walk) are working examples with
placeholder posters. Replace them with your own scenes before launch.

### Reference clips

Seedance reproduces motion, staging and camera from the reference clip. Do not send the
original viral clip as the reference: faces and copyrighted likeness travel with it. Make a
grayscale depth-map video first (Liblib / LibTV depth motion capture, or Video Depth Anything)
so the model only sees motion and staging; set `depthReference: true` in the prompt spec.
User photos go through APIMart's asset-library review before any render starts — celebrity,
public-figure and political faces are rejected. The full playbook (picking a trend, writing
the prompt, review, submit, pricing) is
**[docs/viral-template-playbook.zh-CN.md](./docs/viral-template-playbook.zh-CN.md)**.

## 5. Media bucket

Create a **public** R2 bucket (or any CDN) for template media and upload:

```
templates/<id>/reference.mp4             reference clip sent to Seedance (≤ 30 s)
templates/<id>/soundtrack.m4a            AAC soundtrack aligned to the clip from 0 s
templates/<id>/reference-highlight.mp4   ≤ 15 s cut, for templates with highlightSeconds
templates/<id>/soundtrack-highlight.m4a  the same cut of the soundtrack
templates/<id>/preview.mp4               short muted loop for cards and heroes (optional)
templates/<id>/poster.jpg                still for cards (optional; placeholders ship in /public)
templates/<id>/samples/<n>.mp4           video-wall examples with music (optional, 3–6) and <n>.jpg
```

Set the bucket URL as `mediaUrl` in `site.config.jsonc`; `pnpm site:sync` writes it to
`TEMPLATE_MEDIA_BASE_URL` (server) and `VITE_TEMPLATE_MEDIA_BASE_URL` (web). For local
development set them in `apps/server/.dev.vars` and `apps/web/.env.development`. Use music you
are licensed to distribute with generated videos.

A second, **private** R2 bucket (`STORAGE` binding) holds users' photos and finished renders.

## 6. Pricing

`packages/app-config/src/app-config.ts`:

- `webCreditPackages` — credits, display price and Stripe price IDs (test and live) per pack.
- `creditSignupGrant` — optional free credits for new accounts (off by default).

`packages/app-config/src/video.ts` → `videoConfig`: default credit costs and the first-video
offer. The pricing test (`packages/app-config/src/__tests__/video-pricing.test.ts`)
holds APIMart's per-second rates; update them if your rates change.

In Stripe, create one one-time Price per pack and paste the IDs. Add a webhook to
`https://api.<your-domain>/api/webhooks/stripe` with the `checkout.session.*`,
`payment_intent.*` and `charge.refunded` events, and put its signing secret in
`STRIPE_WEBHOOK_SECRET`.

## 7. Cloudflare resources

```bash
npx wrangler d1 create <d1DatabaseName>          # put the printed database_id in site.config.jsonc
npx wrangler r2 bucket create <r2Bucket>
npx wrangler r2 bucket create <your-media-bucket> # make this one public; its URL is mediaUrl
```

Then:

- Fill in the `cloudflare` section of `site.config.jsonc` and run `pnpm site:sync`. Both
  `wrangler.jsonc` files are generated from it: the API route is `api.<domain>` (the host of
  `SERVER_URL`), the web routes are `<domain>` and `www.<domain>`, and `API_SERVICE` points at
  the server worker.
- `rateLimitNamespaceIds` are positive integers that must be unique within your Cloudflare
  account (sites sharing an id share a counter). `pnpm check:placeholders` checks them.
- Enable Cloudflare Email Service for your domain (or switch `common.email.provider` to
  `resend` and set `RESEND_API_KEY`).

## 8. Deploy

```bash
cp apps/server/.env.production.example apps/server/.env.production   # fill in secrets
pnpm -F server secrets:bulk:production
pnpm db:migrate
pnpm deploy:all
```

`pnpm deploy:all` (and `pnpm deploy:server` / `pnpm deploy:web` on their own) runs
`pnpm check:placeholders` first and stops before building if it fails. Don't type plain
`pnpm deploy`: that is pnpm's own command and skips these scripts.

Point `api.<your-domain>` at the server worker and `<your-domain>` at the web worker (custom
domains in `routes` of both `wrangler.jsonc` files do this on deploy). Set `ADMIN_EMAIL` to give
your account the admin role after its first verified sign-in.

For IndexNow, export `INDEXNOW_KEY` before deploying (or put it in `apps/web/.env.production`).

- **Key file.** The build writes `apps/web/public/<key>.txt`, which is git-ignored.
- **What gets submitted.** After `wrangler deploy` succeeds:
  1. The script waits until the live `/api/pwa-version` reports the new build.
  2. It fetches every sitemap URL and hashes the page's content: title, meta, JSON-LD, links
     and visible text, but not build asset names or scripts.
  3. It submits only URLs that are new or whose hash changed since
     `apps/web/indexnow-sent.json`.
- **The record.** After a successful ping the script rewrites `apps/web/indexnow-sent.json` and
  commits it. **Push that commit**, or the next deploy (e.g. a fresh CI clone) treats every page
  as new.
- **Log output.** The deploy log shows `[indexnow] submitted N URLs (HTTP 200)`; 202 also
  means accepted.
- **Other modes.** `pnpm -F web indexnow --all` submits everything. `--dry-run` lists what
  would be sent, without sending or writing anything.
- **Failures.** They only warn and never fail the deploy.

## 9. Before launch

- [ ] `pnpm check:placeholders` passes (exit 0)
- [ ] Templates have your own reference clips, soundtracks, posters and previews
- [ ] Stripe is in live mode with live price IDs, and the webhook is receiving events
- [ ] A test render completes, the soundtrack plays, and a forced failure refunds credits
- [ ] Privacy policy and terms reviewed for your jurisdiction
- [ ] The deploy log shows `[indexnow] submitted N URLs (HTTP 200/202)` and the
      `apps/web/indexnow-sent.json` commit is pushed
- [ ] Cloudflare → AI Crawl Control isn't blocking crawlers you want (new domains may block AI
      crawlers by default; a managed robots.txt overrides the site's own)
- [ ] Optional: `VITE_GA_MEASUREMENT_ID`, Tawk.to chat
