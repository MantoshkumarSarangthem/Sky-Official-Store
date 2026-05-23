# Sky Official

A Mobile Legends: Bang Bang (MLBB) diamond top-up storefront where users can purchase diamonds, passes, and boosting services with account verification and order tracking.

## Run & Operate

- Frontend runs on port 24534 (proxied to 3000 externally)
- API server runs on port 8080
- Both start automatically — no manual setup needed on new devices

## Required Secrets (only things needed on a new device)

- `ADMIN_PASSWORD` — password to access the admin panel at `/admin`
- `CLERK_PUBLISHABLE_KEY` — from your Clerk dashboard → API Keys
- `CLERK_SECRET_KEY` — from your Clerk dashboard → API Keys

All other environment variables (DATABASE_URL, PGHOST, etc.) are auto-provisioned by Replit.

## Optional Secrets (enable extra notification features)

- `GREENAPI_INSTANCE_ID` — Green API instance ID for WhatsApp order notifications
- `GREENAPI_TOKEN` — Green API token for WhatsApp order notifications
- `NOTIFY_EMAIL` — Gmail address to send/receive order notification emails
- `NOTIFY_EMAIL_APP_PASSWORD` — Gmail app password for the above email account

These are all safe to omit — the app works fully without them; only order notifications via WhatsApp/email are disabled.

## Pre-configured Env Vars (already set, do not change)

- `VAPID_PUBLIC_KEY` — push notification public key (set as shared env var)
- `VAPID_PRIVATE_KEY` — push notification private key (set as shared env var)

## Stack

- pnpm workspaces, Node.js 20, TypeScript
- Frontend: React 19 + Vite + Tailwind CSS v4 + Wouter routing
- API: Express 5 + pg (raw SQL) on port 8080
- Auth: Clerk (frontend + backend)
- DB: Replit PostgreSQL — tables auto-created on first server start via `initDb()` in `artifacts/api-server/src/index.ts`
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/sky-official/src/App.tsx` — entire frontend app + routing
- `artifacts/sky-official/src/components/` — page components (AdminPanel, PackagesSection, PaymentPage, etc.)
- `artifacts/api-server/src/index.ts` — DB table bootstrap (`initDb`)
- `artifacts/api-server/src/routes/` — API routes (admin, orders, wallet, profile, verify)
- `artifacts/api-server/src/app.ts` — Express app + Clerk middleware
- `lib/db/` — Drizzle ORM setup (schema not yet populated; tables managed via raw SQL in initDb)

## Architecture decisions

- DB tables are created with raw SQL via `initDb()` on server startup (not Drizzle migrations), so no manual `db push` is needed
- Clerk auth is proxied through the backend at `/api/__clerk` so it works on `.replit.app` domains without custom DNS
- Admin routes use a simple `ADMIN_PASSWORD` bearer token (not Clerk) so the admin panel is accessible independently of user auth
- Frontend proxies `/api` to `localhost:8080` via Vite dev server config

## Self-Bootstrapping

When this project is opened on any new device or account:
1. Both workflows (`artifacts/sky-official: web` and `artifacts/api-server: API Server`) start automatically
2. Each dev script runs `pnpm -w install` every time — fast (~1s) when already up to date, full install on a fresh device
3. Each dev script also kills any stale process occupying its port before starting, preventing EADDRINUSE errors
4. Database tables are created automatically on first API server start
5. The only manual step is adding the three secrets above (ADMIN_PASSWORD, CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY)

## Page Reference (Custom Names)

Use these names when asking for changes to a specific page:

| Custom Name | Route | What it is |
|---|---|---|
| **Home** | `/` | Landing page — hero, promo banners, stats, how it works |
| **Packages** | `/packages` | Diamond pack listings and rank boosting services |
| **Target** | `/mlbb-target` | Enter MLBB User ID & Server ID, verify account before buying |
| **Cart** | `/cart` | Shopping cart — review items before checkout |
| **Payment** | `/pay` | Checkout — UPI QR code, payment details, order submission |
| **Verify** | `/verify` | Standalone MLBB account verification page |
| **Profile** | `/profile` | User profile — wallet balance, account info |
| **Orders** | `/orders` | Order history — past and pending orders with status |
| **Support** | `/support` | WhatsApp support links and FAQs |
| **Admin** | `/admin` | Admin dashboard — manage orders, packages, users, settings |
| **Staff** | `/staff` | Staff portal — fulfill and manage orders |
| **Sign In** | `/sign-in` | Clerk-powered login page |
| **Sign Up** | `/sign-up` | Clerk-powered registration page |
| **Terms** | `/terms` | Terms of Service |
| **Privacy** | `/privacy` | Privacy Policy |
| **Refund** | `/refund` | Refund Policy |

## User preferences

- Keep secrets out of code and `.replit` — use Replit's secret store only
- The project must be fully self-bootstrapping on new devices

## Gotchas

- Do NOT add `pnpm --filter db push` to post-merge — the Drizzle schema in `lib/db` is empty; tables are managed by raw SQL in `initDb()`
- `pnpm -w install` in dev scripts uses `-w` (workspace root flag) so it installs from the root `pnpm-lock.yaml`
