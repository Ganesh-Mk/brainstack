# ✅ Phase 1 — COMPLETE (Build Report)

> **Status: the entire Phase 1 build is done, verified, and ready to deploy.**
> This document is the handoff: Part A is everything that was built, Part B is
> the short list of things only **you** can do to take it live at
> `brainstack.space`.

---

## Part A — What was built

Everything from `PHASE_1.md`, end to end. The app lives in **`web/`** —
one Next.js 16 app (TypeScript, Tailwind v4, App Router) serving both the
marketing site and the platform shell.

**Verified before writing this report:** `npm run build` compiles clean
(42 routes, zero TypeScript errors), `npm run lint` passes with zero
warnings, and a live production server was booted and smoke-tested — every
key route returns 200 with real content, the settings redirect works, and the
host-based subdomain routing was tested against all three domain cases
(apex, `app.`, `www.`).

### 1. The global design system ⭐ (`web/app/globals.css`)

Exactly what you asked for — **semantic names, dynamic values**:

- **Two layers:** raw primitives on `:root` (`--accent-*`, `--tone-canvas`,
  `--ink-*`, `--line-*`) feed **semantic tokens** in `@theme`
  (`--color-canvas`, `--color-surface`, `--color-accent`, `--color-muted`,
  `--color-border`, …). Components only ever use semantic utilities
  (`bg-canvas`, `text-muted`, `bg-accent`) — **zero hard-coded colors** in
  any component.
- **One `REBRAND HERE` block** — edit the accent ramp or canvas tone there
  and the entire product restyles (marketing site included).
- **Live theme engine** (`lib/theme.ts` + `stores/theme.ts`): 5 accent
  presets (Indigo default, Teal, Blue, Amber, Rose) × 3 canvas tones (Warm
  Kyro-style default, Cool, Pure). Overrides are applied to `:root` at
  runtime, persisted, and re-applied **before first paint** (no flash) via a
  tiny inline script in the root layout.
- **Settings → Appearance is fully LIVE** — the working proof: pick an
  accent or canvas and watch every button, badge, border and background
  follow instantly.
- Kyro-quality visual language throughout: Inter + JetBrains Mono
  (self-hosted via `next/font`), hairline borders + soft ink-tinted shadows,
  `rounded-2xl` cards with hover-lift, quiet entrance animations (all
  disabled under `prefers-reduced-motion`), thin modern scrollbars, dot-grid
  backdrops.

### 2. The single IA registry (`web/lib/nav.ts`)

Every route in the product declares its label, icon, group, **lock state**,
**RBAC roles**, and **which backend phase unlocks it** — in one file. The
sidebar, command palette, settings tabs, Coming Soon pages and the Roadmap
all render from it. **Unlocking a feature later = flip `locked: false` and
replace one page's `<ComingSoon>`. Nothing else moves.**

### 3. Component library (all tokenized)

`components/ui/`: Button (+ButtonLink, 5 variants), Card, Badge (6 variants
incl. `lock`), Input/Textarea/Select/Label/Hint/FieldError, Switch,
PillTabs, SegmentedControl, Table, Modal, Tooltip, Avatar, Dropdown, Toaster
(bottom-right stack with countdown bar), Skeleton (shimmer), Progress,
KpiTile.
`components/patterns/`: **ComingSoon** (registry-driven premium lock page),
LockBadge, PagePreview (dimmed/masked mock), EmptyState, PageHeader, preview
primitives. `components/brand/`: BrandMark + BrandGlyph (accent-colored
stacked-layers logo, also the favicon).

### 4. App shell (`app.brainstack.space`)

- **Sidebar** — 6 grouped sections, active-pill states, 🔒 badges on locked
  items, collapsible to icon rail (persisted), mobile slide-over drawer,
  **RBAC-filtered**: items disappear for roles that can't see them.
- **Topbar** — mock tenant switcher (Acme Corp / Globex Ltd), search field,
  notifications + help, avatar menu with a **demo role simulator**
  (employee / manager / admin) — flip it and watch Operations/Insights/Admin
  appear and vanish. This demos the RBAC story before any backend exists.
- **⌘K command palette** — fuzzy jump to every page, keyboard navigation,
  lock indicators, role-aware.

### 5. Every feature page (17 app pages + 8 settings tabs)

All present, each locked page a **premium Coming Soon** with: icon + pitch,
"Unlocks in: Backend Phase N", capability bullets, Notify-me CTA, and a
**dimmed non-interactive mock of the real interface** behind it:

| Page | State |
|---|---|
| Dashboard | Static sample-data preview (KPIs, chart strip, activity, quick actions) |
| Ask BrainStack | 🔒 three-pane mock: conversations · streaming chat with citations · live agent trace + citation panel |
| Roadmap | ✅ **LIVE** — phase timeline generated from the nav registry |
| Knowledge Library / Add Sources / Ingestion | 🔒 table, dropzone, live-pipeline mocks |
| Agent Trace / Memory | 🔒 step-timeline and short/long-term memory mocks |
| Connections (MCP) / Tickets / Workforce Analytics | 🔒 manager-only; MCP server card with discovered tools, ticket table, workload bars |
| Analytics / Evaluation / Observability | 🔒 admin-only; LLMOps, judge-run and trace-table mocks |
| Team & Roles | 🔒 members table mock |
| Settings | General/Members/Connections/Models/Billing/API-keys 🔒 · **Appearance ✅ LIVE** · Account ✅ (profile UI) |

### 6. Auth & onboarding (UI live, demo-wired)

Login, Signup (create company), Forgot password, Accept invite, and a
3-step onboarding stepper — real validation, centered dot-grid surface,
demo-mode submits that route into the app with a toast explaining what's
mock.

### 7. Marketing site (`brainstack.space`)

- **Landing** — sticky nav, hero with animated product mock (streaming
  answer + live trace), trust strip, How-it-works (Ingest→Ask→Act), the
  **"Retrieval lets it know / Connections let it do"** split, 8-card feature
  grid, animated Trace Teaser, security band, pricing preview, FAQ
  (5 real questions), gradient CTA band, full footer.
- **Subpages** — Features (4 sections, 13 cards), Pricing (tiers + full
  comparison matrix), Security (6 pillars), About, Contact (validated form),
  Blog + Docs (marketing-style Coming Soon), Privacy + Terms, branded 404.

### 8. Infrastructure

- **`proxy.ts`** (Next 16's middleware) — host-based routing: marketing
  paths stay on the apex, app/auth paths on `app.`, `www` → apex, `/` on the
  app host → `/dashboard`. **No-op on localhost and `*.vercel.app`** so dev
  and preview deploys work from a single origin. All three host cases
  smoke-tested with real requests.
- **Env files:**
  - `web/.env.example` (committed) + `web/.env.local` — frontend vars.
  - **`.env` at the repo root (gitignored) + `.env.example` (committed)** —
    the **master template with every variable name** for all future backend
    phases: Anthropic, OpenAI, Pinecone, Supabase (`DATABASE_URL` etc.),
    JWT, Tavily, LangSmith, Redis, and the model/cost defaults. **Paste your
    real keys into `.env` whenever you create each account.**
- Root `.gitignore` protecting secrets; SEO metadata + OG tags; brand
  favicon; `robots: noindex` on the app surface.

---

## Part B — What YOU need to do (the only things I can't)

Two required steps, both ~10 minutes. Everything else is optional.

### 🔴 Required 1 — Put it on Vercel

1. Go to **vercel.com** → sign in **with your GitHub account** (Ganesh-Mk).
2. **Add New → Project** → import **`Ganesh-Mk/brainstack`**.
3. On the configure screen set **Root Directory = `web`** ← the one setting
   that matters. Framework auto-detects as Next.js. Leave build settings
   default.
4. (Optional, in Project → Settings → Environment Variables) add:
   - `NEXT_PUBLIC_ROOT_DOMAIN` = `brainstack.space`
   - `NEXT_PUBLIC_APP_DOMAIN` = `app.brainstack.space`
   (the code defaults to these values anyway, so skipping is fine.)
5. Deploy. You'll get a `*.vercel.app` URL where **everything** works on one
   origin (marketing at `/`, app at `/dashboard`) — that's by design.

### 🔴 Required 2 — Attach your domain

1. In the Vercel project → **Settings → Domains**, add **three** entries:
   `brainstack.space`, `www.brainstack.space`, and `app.brainstack.space`.
2. Vercel will show you exact DNS records. At your domain registrar (where
   you bought `brainstack.space`), add:
   - **A record** for `@` (apex) → the IP Vercel shows (typically `76.76.21.21`).
   - **CNAME** for `app` → `cname.vercel-dns.com`.
   - **CNAME** for `www` → `cname.vercel-dns.com`.
3. Wait for DNS to propagate (minutes to a few hours). Vercel provisions
   HTTPS automatically.
4. Then verify the split-brain routing:
   - `https://brainstack.space` → landing page.
   - `https://app.brainstack.space` → redirects to `/dashboard`.
   - `https://brainstack.space/dashboard` → bounces to the app subdomain.
   - `https://www.brainstack.space` → bounces to the apex.

### 🟡 Whenever you get a minute (not blocking)

- **Supabase** — create a free project at supabase.com, copy the
  **connection string** (Project Settings → Database) into `DATABASE_URL`
  in the root `.env`. Needed from Backend Phase 0, not before.
- **Anthropic** — console.anthropic.com → API key → `ANTHROPIC_API_KEY` in
  `.env`. ⚠️ **Set a hard spend limit ($5–10) first.** Needed from Backend
  Phase 1.
- **Pinecone** — app.pinecone.io → API key → `PINECONE_API_KEY`. Needed at
  the end of Backend Phase 1.
- **Later, in this order of need:** Tavily (Phase 4), OpenAI embeddings
  (prod quality), LangSmith (Phase 7).
- Every variable name is already waiting in the root `.env` with comments
  telling you where to get it.

### ▶️ Try it locally right now

```bash
cd web
npm run dev
```

Open `http://localhost:3000` — the landing page. Then:
- `http://localhost:3000/dashboard` — the app shell.
- Press **⌘K / Ctrl+K** — jump anywhere.
- **Avatar menu → Demo role → Employee** — watch Operations, Insights and
  Admin vanish from the sidebar. Switch back to Admin.
- **Settings → Appearance** — change the accent to Teal and the canvas to
  Cool. The entire product restyles. Hit Reset.
- Visit `/ask`, `/connections`, `/analytics` — every locked page previews
  its real future interface.

---

## Definition-of-done checklist (from PHASE_1.md §15)

- [x] Polished, responsive marketing site (deploys with your Vercel step)
- [x] Full app shell with **every** feature page present, locked pages as premium previews
- [x] Sidebar lock badges + role-based visibility with a live role simulator
- [x] One accent/canvas change restyles the entire product — proven by the live Appearance page
- [x] Zero hard-coded colors — everything flows through semantic tokens
- [x] Kyro-grade visual consistency (compact, hairline borders, rounded-2xl, quiet motion)
- [x] ⌘K palette jumps to any page; subdomain routing verified for prod and dev
- [x] Env scaffolding ready (Supabase + all backend keys templated in `.env`)
- [ ] **You:** Vercel import (Root Directory = `web`) ← Required 1
- [ ] **You:** DNS records at your registrar ← Required 2

Once those two boxes are ticked, **Phase 1 is wrapped** — and the next step
is `PROJECT_GUIDE.md` **Backend Phase 0** (FastAPI + Supabase + JWT), which
plugs into pages that are already waiting for it.
