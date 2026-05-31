@AGENTS.md

# save-atlas — CLAUDE.md

## What this is

Personal content-saving app + companion Chrome extension. Save Instagram posts, images, and videos to a personal dashboard — browse, search, and rediscover them privately. Goal: engagement (users saving and returning to their collection).

## Stack

- **Framework**: Next.js 16 App Router (JavaScript, not TypeScript)
- **Language**: JavaScript
- **Styling**: Tailwind CSS v4 + CSS Modules (`.module.css` per route)
- **DB**: Supabase (Postgres + Auth via `@supabase/ssr`)
- **Auth**: Supabase Auth (cookie-based via middleware)
- **Hosting**: Vercel
- **Other notable libs**: lucide-react, jszip (for bulk export/import)

## Commands

```bash
# Install
npm install

# Dev
npm run dev            # runs on http://localhost:3000

# Test
npm test               # vitest unit tests
npm run test:e2e       # playwright e2e

# Lint
npm run lint

# Build
npm run build
```

No typecheck script (JavaScript project — no TypeScript).

## Project structure

```
app/
├── page.js            # Landing / home (checks auth, redirects to dashboard)
├── layout.js          # Root layout
├── dashboard/         # Main saved-content grid view
├── import/            # Bulk import page
├── auth/              # Auth callback (Supabase OAuth flow)
├── login/             # Login page
└── api/
    ├── auth/          # Auth API routes
    ├── import/        # Import endpoint
    ├── saves/         # Saves CRUD
    └── stats/         # Usage stats
lib/
├── supabase-client.js # Browser Supabase client
├── supabase-server.js # Server Supabase client (RSC)
├── supabase.js        # Shared helpers
├── aiSearch.js        # AI-powered search
└── categorize.js      # Content categorization
extension/             # Chrome extension
├── manifest.json
├── background.js      # Service worker
├── content.js         # Page injector
└── popup/             # Extension popup UI
supabase/
├── schema.sql         # Table definitions
└── verify.sql         # RLS policies
```

Important files:
- `lib/supabase-client.js` — browser Supabase client (import from here)
- `lib/supabase-server.js` — server Supabase client (RSC + API routes)
- `middleware.js` — Supabase auth session refresh on every request
- `extension/manifest.json` — Chrome extension manifest

## Conventions

- **Imports**: use `@/` alias (maps to repo root)
- **Supabase client**: use `supabase-client.js` in client components, `supabase-server.js` in server components and API routes — never instantiate directly
- **No TypeScript** — plain JavaScript throughout; don't introduce TypeScript
- **CSS**: CSS Modules for layout/route-specific styles, Tailwind utilities inline
- **Auth**: handled by middleware and Supabase SSR; don't roll custom session logic

## Git workflow

- Branches: `vipul/<short-description>` for solo work
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`)
- PRs: include preview URL; screenshots for UI changes
- Squash-merge to `main`

## Deploy

- Production: Vercel auto-deploys on push to `main`
- Preview: every PR gets a preview URL — paste in PR description
- Env vars (Vercel dashboard): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Database

Supabase (Postgres). Schema in `supabase/schema.sql`, RLS policies in `supabase/verify.sql`.
- Apply schema changes via Supabase Studio or CLI — there's no migration tool configured in scripts
- **Never drop or alter production tables without a tested rollback plan**

## Testing philosophy

- vitest for unit tests; playwright for e2e (in `e2e/`)
- New features ship with at least one happy-path test.

## Things that are out of scope

- Don't add TypeScript — this project is intentionally JavaScript
- Don't introduce a new CSS framework — Tailwind + CSS Modules is the pattern

## Known gotchas

- **Next.js 16 breaking changes**: APIs and conventions differ from training data. Read `node_modules/next/dist/docs/` before writing routing or middleware code.
- `fixEncoding` utility in `dashboard/page.js` exists because Instagram garbles UTF-8 — preserve it when touching that page.
- The Chrome extension has its own build/load cycle — changes to `extension/` require reloading the unpacked extension in Chrome.
- Instagram images are served from `**.cdninstagram.com` and `**.fbcdn.net` — those domains are allowlisted in `next.config.mjs`.

## Product context

- **Audience**: People who save a lot on Instagram and want a private, browsable archive outside the app
- **Goal right now**: Engagement — users saving content and returning to their dashboard
- **Voice**: Gen Z, Instagram-native, young and self-aware. Playful, a little cheeky. Speaks the language of people who live on Instagram.
- **Pricing**: Free (no pricing model yet)
- **What we'd never say**: Anything corporate or clunky. This is for people who care about aesthetics.

## Decision log

Log significant architectural decisions here so they're not relitigated.
