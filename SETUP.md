# Setup guide

From a fresh copy to a live site. Run `pnpm check:placeholders` at any point to see what is
left to replace.

## 1. Prerequisites

- Node.js 22+ and pnpm 10 (`corepack enable`)
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

| What                                              | Where                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| Product name, support email, website, social link | `packages/app-config/src/app-config.ts` → `common.app`                      |
| Email sender domain                               | `packages/app-config/src/app-config.ts` → `common.email.from`               |
| Colors, radius, fonts                             | `packages/ui/src/styles/theme.css` (`--primary`, `--ring`, `.dark`)         |
| Logo                                              | `apps/web/src/components/logos/svg/logo.tsx` and `apps/web/public/logo.svg` |
| Favicons and PWA icons                            | `apps/web/public/favicon*.ico`, `apps/web/public/pwa/*`                     |
| PWA name and colors                               | `apps/web/public/manifest.webmanifest`                                      |
| Social share image                                | `apps/web/public/og/og.png` (1200 × 630)                                    |
| All page copy                                     | `packages/i18n/src/messages/web/{en,zh,jp}.json` → `video`                  |
| Privacy policy and terms                          | same files → `legal` (review with your own counsel)                         |
| Sign-in methods                                   | `packages/app-config/src/app-config.ts` → `common.auth.methods`             |

Dark is the default theme; visitors can switch to light.

## 4. Templates

A template has three parts. The ids must match everywhere.

1. **Shape and price** — `packages/app-config/src/video.ts`
   Add the id to `VIDEO_TEMPLATE_IDS` and an entry to `videoTemplates`: aspect ratio, length,
   photo slots, optional `minPhotos`, `allowsPets`, `highlightSeconds` (for Seedance 2.0 when
   the clip is longer than 15 s) and per-quality `creditsCost`.
2. **Reference media and prompt** — `apps/server/src/video/templates.ts`
   Describe the cast, the scene and the shot timeline with `buildReferencePrompt`. Keep the
   shot times aligned with the cuts in your reference clip.
3. **Copy and media** — `packages/i18n/src/messages/web/*.json` → `video.templates.<id>`
   (name, tagline, description, keywords, hashtag, one `<slot>Role` per photo slot) and
   `apps/web/src/lib/video/templates.ts` (poster, preview loop, optional sample render).

The landing page (`/templates/<id-with-dashes>`), gallery, studio, sitemap and llms.txt update
on their own. `pnpm -F @repo/app-config test` checks every template keeps your margin target;
`pnpm -F server test` checks every prompt stays under Seedance's length limit.

The three shipped templates (Duo Dance, Solo Spotlight, Squad Walk) are working examples with
placeholder posters. Replace them with your own scenes before launch.

### Reference clips

Seedance reproduces motion, staging and camera from the reference clip. Depth-map renders
(e.g. made with Video Depth Anything) work well because they carry motion without the original
people's appearance; set `depthReference: true` in the prompt spec for those. Only use footage
you have the rights to.

## 5. Media bucket

Create a **public** R2 bucket (or any CDN) for template media and upload:

```
templates/<id>/reference.mp4             reference clip sent to Seedance (≤ 30 s)
templates/<id>/soundtrack.m4a            AAC soundtrack aligned to the clip from 0 s
templates/<id>/reference-highlight.mp4   ≤ 15 s cut, for templates with highlightSeconds
templates/<id>/soundtrack-highlight.m4a  the same cut of the soundtrack
templates/<id>/preview.mp4               short muted loop for cards and heroes (optional)
templates/<id>/poster.jpg                still for cards (optional; placeholders ship in /public)
```

Set the bucket URL as `TEMPLATE_MEDIA_BASE_URL` (server) and `VITE_TEMPLATE_MEDIA_BASE_URL`
(web). Use music you are licensed to distribute with generated videos.

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
npx wrangler d1 create your-project-db          # copy database_id into apps/server/wrangler.jsonc
npx wrangler r2 bucket create your-project-bucket
npx wrangler r2 bucket create your-project-media # make this one public
```

Then edit:

- `apps/server/wrangler.jsonc` — worker name, D1 name and id, bucket name, `WEBSITE_URL`,
  `SERVER_URL`, `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID`, `TEMPLATE_MEDIA_BASE_URL`.
- `apps/web/wrangler.jsonc` — worker name, custom domains, the `API_SERVICE` service name
  (must equal the server worker name), `VITE_*` values, Turnstile site key.
- Enable Cloudflare Email Service for your domain (or switch `common.email.provider` to
  `resend` and set `RESEND_API_KEY`).

## 8. Deploy

```bash
cp apps/server/.env.production.example apps/server/.env.production   # fill in secrets
pnpm -F server secrets:bulk:production
pnpm db:migrate
pnpm deploy
```

Point `api.<your-domain>` at the server worker and `<your-domain>` at the web worker (custom
domains in `wrangler.jsonc` do this on deploy). Set `ADMIN_EMAIL` to give your account the
admin role after its first verified sign-in.

## 9. Before launch

- [ ] `pnpm check:placeholders` reports nothing you still need to change
- [ ] Templates have your own reference clips, soundtracks, posters and previews
- [ ] Stripe is in live mode with live price IDs, and the webhook is receiving events
- [ ] A test render completes, the soundtrack plays, and a forced failure refunds credits
- [ ] Privacy policy and terms reviewed for your jurisdiction
- [ ] Optional: `VITE_GA_MEASUREMENT_ID`, Tawk.to chat, `INDEXNOW_KEY` for search pings
