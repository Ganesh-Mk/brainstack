# 🧠 BrainStack — Phase 1: The Product Shell & Design System

> **Companion to `PROJECT_IDEA.md` and `PROJECT_GUIDE.md`.**
> This document defines **Phase 1 of the *product*** — the entire frontend: the marketing
> landing page, the full authenticated app shell, **every page/tab/icon of every feature**
> (locked with *Coming Soon* until its backend phase lands), one **globally-swappable design
> system**, and **live hosting on Vercel** at `brainstack.space` + `app.brainstack.space`.
>
> **Naming note:** `PROJECT_GUIDE.md` Part 3 has its own "Phase 0 / Phase 1 …" for the *AI
> backend* (RAG, ingestion, agent, MCP…). **This document is a parallel track — the
> product/UI build.** Think of it as **"Product Phase 1."** The two tracks meet: as each
> backend phase from the guide ships, we *unlock* the matching page here by removing its
> *Coming Soon* state.

---

## 0. Table of contents

1. [What Phase 1 delivers (and does not)](#1-what-phase-1-delivers-and-does-not)
2. [Guiding principles](#2-guiding-principles)
3. [Tech stack (frontend)](#3-tech-stack-frontend)
4. [Deployment & domains](#4-deployment--domains-one-app-two-subdomains)
5. [Repo / folder structure](#5-repo--folder-structure)
6. [The global design system](#6-the-global-design-system-)
7. [The *Coming Soon* / Lock pattern](#7-the-coming-soon--lock-pattern)
8. [Information architecture — the full map](#8-information-architecture--the-full-map)
9. [Landing page spec (`brainstack.space`)](#9-landing-page-spec-brainstackspace)
10. [App shell spec (`app.brainstack.space`)](#10-app-shell-spec-appbrainstackspace)
11. [Feature pages — every screen, one by one](#11-feature-pages--every-screen-one-by-one)
12. [Component inventory](#12-component-inventory)
13. [Supabase & environment setup](#13-supabase--environment-setup)
14. [Phase 1 build checklist & order](#14-phase-1-build-checklist--order)
15. [Definition of done](#15-definition-of-done)

---

## 1. What Phase 1 delivers (and does not)

**The goal:** ship a **real, deployed, professional-looking product surface** where you (and
anyone you show it to) can click through the *entire vision* of BrainStack — every feature,
every page — even though the AI underneath isn't built yet. It's the showroom before the
engine. It also front-loads all the boring-but-critical scaffolding (design system, routing,
hosting, auth screens) so that from the guide's Phase 2 onward you *only* write AI code and
drop it behind pages that already exist.

### ✅ In scope for Phase 1

| Area | What ships |
|---|---|
| **Marketing landing** | Full `brainstack.space` — hero, how-it-works, features, RAG/MCP explainer, security, pricing, FAQ, footer. Real, polished, live. |
| **Design system** | One globally-swappable token system (colors, type, spacing, radius, shadow, motion) + a core component library. Change one value → whole app restyles. |
| **App shell** | `app.brainstack.space` — sidebar nav, topbar, command palette, responsive layout, all route groups wired. |
| **Every feature page** | Dashboard, Ask/Chat, Knowledge, Agent, Connections, Actions, Analytics, Evaluation, Observability, Team, Settings — **all present**, each showing a *Coming Soon* state that previews what it will become. |
| **Auth screens** | Login, Sign up (create company), Forgot password, Accept invite, Onboarding — as **UI** (real wiring comes with the backend). |
| **Hosting** | Deployed to Vercel. `brainstack.space` → landing, `app.brainstack.space` → app. Domain attached. HTTPS. |
| **Appearance settings** | A live theme/accent picker that writes to the design tokens — proving the "change everything globally" promise. |

### ❌ Explicitly NOT in scope for Phase 1

- No real RAG, agent, MCP, embeddings, Pinecone, or LLM calls. (Those are the guide's phases.)
- No real backend business logic. Auth forms may be **mocked** or wired to a thin Supabase/stub
  — but no ingestion, no chat responses.
- No real data in dashboards — everything shows **skeletons, empty states, or *Coming Soon***.
- No Celery, no Docker of the Python services. This track is **frontend + hosting only**.

> **The one-line test for "is this Phase 1 work?":** *Can I build it without an LLM?* If yes,
> it's here. If it needs the model, it's a backend phase and its page just shows *Coming Soon*.

---

## 2. Guiding principles

1. **Professional & compact.** Dense, intentional, enterprise-grade — not a bootcamp toy.
   Tight vertical rhythm, generous-but-not-wasteful whitespace, small confident type, subtle
   depth. Reference: **Kyro Systems' UI** (`D:\Marqait\kyro-systems\kyro-automations-frontend`)
   — near-black ink on a soft canvas, `rounded-2xl` cards with hairline borders + soft shadow,
   lucide icons, quiet motion.
2. **One source of truth for design.** Every color, radius, shadow, and font is a **semantic
   token** defined in exactly one place. No hard-coded hex anywhere in components. Rebranding is
   editing a handful of variables — see §6.
3. **Semantic token names, never literal.** We use `--color-canvas`, `--color-surface`,
   `--color-accent` — **not** `cream`, `blue`, `red`. The *value* of `--color-canvas` can be any
   color; the *name* never lies about its role. (This is your explicit requirement.)
4. **Show the whole vision, lock the unfinished.** Every feature has a real page and a real spot
   in the nav *now*, so the product's full shape is legible. Unfinished features wear a 🔒 and a
   *Coming Soon* screen that **previews** the feature, not a dead end.
5. **Build the shell once, fill it forever.** Nothing about the layout, nav, or design system
   should need rework when AI phases land. We're pouring the foundation for all 8 backend phases.
6. **Accessible & responsive by default.** Keyboard-navigable, focus-visible, `prefers-reduced-
   motion` respected, works from 360px to ultrawide.

---

## 3. Tech stack (frontend)

| Layer | Choice | Why |
|---|---|---|
| **Framework** | **Next.js (App Router)** | Matches the guide's stack; route groups + middleware give us subdomain routing in one app; first-class on Vercel. |
| **Language** | **TypeScript** | Non-negotiable for a real product. |
| **Styling** | **Tailwind CSS v4** (`@theme` tokens) | Exactly Kyro's approach — design tokens live in CSS `@theme`, utilities consume them. This *is* our global design system mechanism. |
| **Components** | **shadcn/ui** (as a base) + our own tokenized wrappers | Matches guide. We re-skin shadcn to our tokens so nothing looks generic. |
| **Icons** | **lucide-react** | Same as Kyro. Consistent, huge set, tree-shakeable. |
| **Fonts** | **Inter** (UI) + optional **mono** for traces/JSON | Kyro uses Inter. Loaded via `next/font` (self-hosted, no layout shift). |
| **State (UI)** | React state + **Zustand** for cross-cutting UI (theme, sidebar, command palette) | Kyro uses a small store pattern; we mirror it. |
| **Data fetching (later)** | **TanStack Query** | Kyro uses it; we wire it in Phase 1 but it has nothing to fetch yet. |
| **Forms** | **react-hook-form + zod** | For auth/settings forms. |
| **Animation** | CSS keyframes (Kyro-style) + **Framer Motion** only where needed | Keep it quiet and cheap. |
| **Hosting** | **Vercel** | One app, two subdomains, auto HTTPS, preview deploys per PR. |
| **DB (metadata, later phases)** | **Supabase** (managed Postgres) | Your choice. Phase 1 doesn't need it live; env is prepared. Auth stays custom FastAPI JWT per the guide. |

> **Why not Vite (like Kyro)?** Kyro is a Vite SPA. BrainStack is Next.js because the guide
> already specced Next.js, and because subdomain routing + marketing SEO + Vercel edge are all
> easier in Next. We **borrow Kyro's *visual* system**, not its build tooling.

---

## 4. Deployment & domains (one app, two subdomains)

**Decision (yours): one Next.js app**, deployed once to Vercel, serving both surfaces.

```
                         ┌─────────────────────────────────────────┐
   brainstack.space ────▶│                                         │
   (apex → marketing)    │        ONE Next.js app on Vercel        │
                         │                                         │
   app.brainstack.space ▶│   middleware.ts reads the Host header   │
   (→ the platform)      │   and rewrites to the right route group │
                         └─────────────────────────────────────────┘
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 ▼                                                  ▼
        app/(marketing)/*                                    app/(app)/*
        landing, pricing, features,                          dashboard, ask, knowledge,
        security, legal, blog(soon)                          agent, connections, actions,
                                                             analytics, eval, team, settings
```

**How the routing works (Vercel-native):**

- **`middleware.ts`** inspects the `Host` header:
  - `app.brainstack.space` → rewrite the request into the **`(app)`** route group.
  - `brainstack.space` / `www` → serve the **`(marketing)`** route group (default).
- Route **groups** (`(marketing)` / `(app)`) let both live in one `app/` tree with **separate
  root layouts** (marketing has a public navbar/footer; app has the sidebar shell) while sharing
  the *same* design tokens and component library.
- **Local dev:** subdomains are awkward on `localhost`, so also support **path prefixes** as a
  fallback (`localhost:3000/` = marketing, `localhost:3000/app` = app). Middleware handles both:
  host-based in prod, path-based in dev.

**Vercel setup (one-time):**

1. Import the repo → Vercel project.
2. **Domains** tab → add `brainstack.space` (apex) and `app.brainstack.space`.
3. At your domain registrar (where you bought `brainstack.space`), point DNS at Vercel:
   - Apex `brainstack.space` → Vercel's A record / ALIAS (Vercel shows the exact value).
   - `app` CNAME → `cname.vercel-dns.com`.
   - Optional `www` → redirect to apex.
4. Vercel auto-provisions HTTPS for all three.
5. Every PR gets a **preview URL** automatically — use these to review UI before merging.

> **Auth redirect model:** the marketing "Log in / Get started" buttons link to
> `https://app.brainstack.space/login` (prod) or `/app/login` (dev). After login the app lives
> entirely under the `app.` subdomain. Cookies are scoped to `.brainstack.space` so a future
> shared session works across both.

---

## 5. Repo / folder structure

```
brainstack/                          ← (this repo)
├── docs/
│   ├── PROJECT_IDEA.md
│   ├── PROJECT_GUIDE.md
│   ├── PHASE_1.md                   ← this file
│   └── PHASE_1_COMPLETE.md
│
└── web/                             ← the Next.js product (Phase 1 lives here)
    ├── middleware.ts                ← host-based subdomain routing
    ├── next.config.ts
    ├── tailwind / postcss config
    ├── app/
    │   ├── globals.css              ← ⭐ THE DESIGN TOKENS (@theme) — single source of truth
    │   ├── (marketing)/             ← brainstack.space
    │   │   ├── layout.tsx           ← public navbar + footer
    │   │   ├── page.tsx             ← landing (hero → footer)
    │   │   ├── features/page.tsx
    │   │   ├── pricing/page.tsx
    │   │   ├── security/page.tsx
    │   │   ├── blog/page.tsx        ← Coming Soon
    │   │   ├── docs/page.tsx        ← Coming Soon
    │   │   ├── about/page.tsx
    │   │   ├── contact/page.tsx
    │   │   └── legal/{privacy,terms}/page.tsx
    │   │
    │   ├── (auth)/                  ← app.brainstack.space/login etc. (no sidebar)
    │   │   ├── layout.tsx           ← centered auth surface (Kyro sign-in style)
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx      ← create company (tenant)
    │   │   ├── forgot/page.tsx
    │   │   ├── invite/page.tsx      ← accept an invite
    │   │   └── onboarding/page.tsx  ← post-signup workspace setup
    │   │
    │   └── (app)/                   ← app.brainstack.space (the platform shell)
    │       ├── layout.tsx           ← ⭐ sidebar + topbar shell
    │       ├── dashboard/page.tsx
    │       ├── ask/page.tsx         ← the core chat/agent workspace
    │       ├── knowledge/
    │       │   ├── page.tsx         ← library
    │       │   ├── add/page.tsx     ← add sources
    │       │   └── ingestion/page.tsx
    │       ├── agent/
    │       │   ├── trace/page.tsx
    │       │   └── memory/page.tsx
    │       ├── connections/page.tsx ← MCP
    │       ├── actions/
    │       │   ├── tickets/page.tsx
    │       │   └── analytics/page.tsx
    │       ├── analytics/page.tsx   ← LLMOps dashboard
    │       ├── evaluation/page.tsx
    │       ├── observability/page.tsx
    │       ├── team/page.tsx
    │       └── settings/
    │           ├── general/page.tsx
    │           ├── members/page.tsx
    │           ├── connections/page.tsx
    │           ├── models/page.tsx      ← model + cost controls
    │           ├── appearance/page.tsx  ← ⭐ live theme/accent picker
    │           ├── billing/page.tsx
    │           ├── api-keys/page.tsx
    │           └── account/page.tsx
    │
    ├── components/
    │   ├── ui/                      ← tokenized primitives (Button, Card, Badge, Input…)
    │   ├── layout/                  ← Sidebar, Topbar, CommandPalette, Footer, MarketingNav
    │   ├── marketing/               ← Hero, FeatureGrid, PricingTable, FAQ…
    │   ├── patterns/                ← ComingSoon, LockBadge, EmptyState, PagePreview
    │   └── brand/                   ← Logo / BrainMark (the 🧠 wordmark)
    │
    ├── lib/
    │   ├── nav.ts                   ← ⭐ nav config: routes, icons, lock flags (single source)
    │   ├── theme.ts                 ← theme presets + apply logic
    │   ├── cn.ts                    ← className merge helper (like Kyro)
    │   └── utils.ts
    │
    └── stores/
        ├── ui.ts                    ← sidebar collapsed, command palette open
        └── theme.ts                 ← active theme/accent (persisted)
```

> **One promise this structure keeps:** when the guide's Phase 3 (real chat) is done, you edit
> **only** `app/(app)/ask/page.tsx` and flip its lock flag in `lib/nav.ts`. Nothing else moves.

---

## 6. The global design system ⭐

This is the heart of Phase 1 and your explicit requirement: **one place controls everything, and
tokens are named by *role*, not by *color*.**

### 6.1 Philosophy

- **Tokens, not values.** Components reference `bg-canvas`, `text-primary`, `border-border`,
  `bg-accent` — never `#faf9f7` or `bg-indigo-600`.
- **Semantic names.** A token says *what it's for* (`surface`, `muted`, `accent`), so its value
  can change (canvas could become warm cream, cool grey, or off-white) without any name becoming
  a lie. This is exactly the "canvas color must be dynamic" ask.
- **Two-layer tokens.** A **primitive** layer (raw scale, e.g. `--accent-600`) feeds a
  **semantic** layer (`--color-accent: var(--accent-600)`). Components only ever touch the
  semantic layer. Rebrand = repoint the semantic layer at a new primitive scale.
- **Runtime-swappable.** Because tokens are CSS variables, the **Appearance settings page**
  (§11) can rewrite them live on `:root` — proving the system.

### 6.2 The token file — `app/globals.css`

> This is the **single source of truth**. Kyro-inspired light theme, but every name is semantic.
> Default accent is a refined indigo (the "intelligence" signal) tuned to read well on a light
> canvas. **To rebrand the entire product, edit only the block marked `REBRAND HERE`.**

```css
@import 'tailwindcss';

@theme {
  /* ============================================================= */
  /*  REBRAND HERE — change these and the whole product restyles.  */
  /* ============================================================= */

  /* --- Accent scale (primitive). Swap this ramp to rebrand. --- */
  --accent-50:  #eef0ff;
  --accent-100: #e0e3ff;
  --accent-200: #c6ccff;
  --accent-300: #a3abff;
  --accent-400: #7f86f8;
  --accent-500: #5b60e8;   /* base */
  --accent-600: #4f46e5;   /* primary accent — buttons, links, active */
  --accent-700: #4338ca;
  --accent-800: #3730a3;
  --accent-900: #312e81;

  /* --- Canvas / surface primitives (the "cream is now dynamic" bit) --- */
  --tone-canvas:   #faf9f7;   /* app + sidebar background (was Kyro "cream") */
  --tone-surface:  #ffffff;   /* cards / content surface (was Kyro "page")   */
  --tone-raised:   #f4f2ee;   /* subtle secondary surface / hovered rows      */

  /* --- Ink primitives --- */
  --ink-900: #1b1b1a;   /* strong text, buttons, active nav */
  --ink-800: #2e2d2a;   /* hover on strong */
  --ink-500: #6b6862;   /* secondary text (muted) */
  --ink-400: #9a958c;   /* tertiary text / placeholders (subtle) */

  /* --- Line primitives --- */
  --line-soft:   #e6e2d9;   /* borders / dividers */
  --line-strong: #d3cec2;   /* stronger dividers */

  /* --- Status primitives --- */
  --ok-500:   #16a34a;
  --warn-500: #d97706;
  --err-500:  #dc2626;
  --info-500: #2563eb;

  /* ============================================================= */
  /*  SEMANTIC LAYER — components use ONLY these. Don't hard-code.  */
  /* ============================================================= */
  --color-canvas:        var(--tone-canvas);
  --color-surface:       var(--tone-surface);
  --color-surface-raised:var(--tone-raised);

  --color-primary:       var(--ink-900);   /* strong text / solid buttons */
  --color-primary-hover: var(--ink-800);
  --color-foreground:    var(--ink-900);
  --color-muted:         var(--ink-500);
  --color-subtle:        var(--ink-400);

  --color-border:        var(--line-soft);
  --color-border-strong: var(--line-strong);

  --color-accent:        var(--accent-600);
  --color-accent-hover:  var(--accent-700);
  --color-accent-soft:   var(--accent-50);   /* tinted backgrounds, badges */
  --color-on-accent:     #ffffff;            /* text on an accent fill */

  --color-success: var(--ok-500);
  --color-warning: var(--warn-500);
  --color-danger:  var(--err-500);
  --color-info:    var(--info-500);

  /* --- Non-color tokens (also global) --- */
  --radius-sm: 0.5rem;
  --radius:    0.75rem;   /* default card/control radius */
  --radius-lg: 1rem;      /* rounded-2xl feel */
  --radius-xl: 1.5rem;

  --shadow-sm: 0 1px 2px rgb(27 27 26 / 0.05);
  --shadow:    0 4px 16px rgb(27 27 26 / 0.06);
  --shadow-lg: 0 12px 32px rgb(27 27 26 / 0.10);

  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
```

> **The rebrand promise, proven:** want a teal product on a warm-cream canvas? Edit the
> `--accent-*` ramp and `--tone-canvas`. Nothing in any component changes. Want a completely
> different accent this afternoon? One ramp. That's the whole point of the two-layer scheme.

### 6.3 Typography

| Role | Token / class | Value |
|---|---|---|
| Display (hero) | `text-5xl / 6xl`, `font-semibold`, tight tracking | Marketing headlines |
| H1 (page title) | `text-2xl font-semibold text-primary` | App page headers |
| H2 (section) | `text-lg font-semibold text-primary` | Card/section titles |
| Body | `text-sm leading-6 text-foreground` | Default app text (compact) |
| Muted/meta | `text-sm text-muted` / `text-xs text-subtle` | Secondary info |
| Label (eyebrow) | `text-xs font-semibold uppercase tracking-wide text-accent` | Category eyebrows (Kyro pattern) |
| Mono | `font-mono text-xs` | Trace steps, JSON, tokens, IDs |

Base font: **Inter**, self-hosted via `next/font`. Compact default body size (`text-sm`) — this
is what makes it read "professional/dense" rather than "landing-page big."

### 6.4 Spacing, radius, shadow, motion

- **Spacing:** Tailwind's 4px scale. Cards use `p-6`; compact rows `px-4 py-2.5`; page gutters
  `px-6 lg:px-8`. Vertical section rhythm on marketing: `py-20 lg:py-28`.
- **Radius:** controls/inputs `rounded-lg` (`--radius`), cards `rounded-2xl` (`--radius-lg`),
  pills/badges `rounded-full`. (Matches Kyro's `rounded-2xl` cards, `rounded-lg` buttons.)
- **Shadow:** hairline border + `shadow-sm` at rest; `shadow-xl` + `-translate-y-0.5` on hover
  for interactive cards (straight from Kyro's `AutomationCard`).
- **Motion:** port Kyro's keyframes — `fade-up`, `fade-in`, `scale-in`, `float`, `grow-x` — for
  entrances and the auth/marketing surfaces. All neutralized under `prefers-reduced-motion`.
  Everyday interactions use a plain `transition` (150–200ms).

### 6.5 Iconography

- **lucide-react** everywhere. One icon per nav item (see §8), stroke width default, sized
  `h-4 w-4` (inline) / `h-5 w-5` (nav) / `h-11 w-11` container tiles (Kyro card pattern:
  icon in a `rounded-xl` solid-primary tile).
- The brand mark: a `🧠`-derived **BrainMark** SVG + "BrainStack" wordmark in `components/brand/`,
  colorable via `currentColor` so it inherits accent/ink.

### 6.6 Core component library (tokenized)

All live in `components/ui/`, re-skinned shadcn or hand-built, **consuming only semantic tokens**:

`Button` (variants: `primary` solid-ink, `accent`, `outline`, `ghost`, `danger`) · `Card` ·
`Badge` (`neutral / accent / success / warning / danger / lock`) · `Input` · `Textarea` ·
`Select` · `Switch` · `Tabs` / `PillTabs` · `Table` · `Modal` (Kyro's exact pattern) ·
`Tooltip` · `Avatar` · `Dropdown` · `Toast` (Kyro bottom-right stack) · `Skeleton` ·
`EmptyState` · `Breadcrumb` · `Progress` (for the ingestion preview) · `KpiTile` (dashboard) ·
`SegmentedControl`.

> **Rule:** a component that hard-codes a color fails review. If a value is missing from tokens,
> add a token — don't inline a hex.

---

## 7. The *Coming Soon* / Lock pattern

Because Phase 1 shows the whole product but almost nothing is built, we need **one consistent,
attractive way** to say "this is coming." Three coordinated pieces:

### 7.1 `lib/nav.ts` — the single lock registry

Every route declares its lock state in one config, consumed by the sidebar, breadcrumbs, and
pages. Unlocking a feature later = flipping `locked: false` here.

```ts
// lib/nav.ts  (shape, not final code)
export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  locked: boolean          // ← shows 🔒 + Coming Soon
  role?: 'employee' | 'manager' | 'admin'   // RBAC visibility
  unlocksIn?: string       // e.g. "Backend Phase 3" — shown on the Coming Soon page
  group: 'Workspace' | 'Knowledge' | 'Intelligence' | 'Operations' | 'Admin'
}
```

### 7.2 `<LockBadge />` — the nav marker

A small `🔒` pill (`Badge` variant `lock`, muted, `text-subtle`) rendered next to any nav item
where `locked`. The item is **still clickable** — it routes to the page, which shows:

### 7.3 `<ComingSoon />` — the page state

Not a dead "404-ish" wall. A **preview** that keeps the vision legible:

```
┌───────────────────────────────────────────────────────────┐
│  [icon tile]   Ask BrainStack                     🔒 Coming │
│                                                             │
│  Ask any question and get a grounded, cited answer from     │
│  your company's knowledge — with a live view of the agent's │
│  reasoning.                                                 │
│                                                             │
│  Unlocks in: Backend Phase 3 · Grounded Q&A + streaming     │
│                                                             │
│  ┌── what this page will do ──────────────────────────────┐ │
│  │ • Token-by-token streaming answers                     │ │
│  │ • Inline citations you can click to the source page    │ │
│  │ • Live Agent Trace panel                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  [ Notify me when it's live ]   [ See the roadmap ]         │
│                                                             │
│  ┆ a dimmed, non-interactive PREVIEW of the real layout    │
│  ┆ (blurred/greyed mock of the eventual UI behind it)       │
└───────────────────────────────────────────────────────────┘
```

- **Header:** icon tile + title + `🔒 Coming Soon` badge.
- **Pitch:** one sentence of what it does (pulled from `PROJECT_IDEA.md`).
- **"Unlocks in":** the backend phase, so the roadmap is self-documenting.
- **Bullets:** the concrete capabilities that page will gain.
- **Dimmed preview:** a **greyed/blurred, non-interactive mock** of the eventual layout sits
  behind/below — so viewers *see* the real thing coming, not just read about it. This is what
  makes the shell feel like a product, not placeholders.
- **CTAs:** "Notify me" (stub) + "See the roadmap".

> **Design intent:** *Coming Soon* should feel **premium and intentional** — like a
> deliberately-staged rollout — never like an unfinished bug. Consistent component = consistent
> feeling across all 15+ locked pages.

---

## 8. Information architecture — the full map

Everything that will ever exist, present from day one. 🔒 = locked/Coming Soon in Phase 1.
`role` = who even sees it (RBAC-driven visibility; managers/admins see more).

### 8.1 Marketing site (`brainstack.space`)

| Route | Page | Status |
|---|---|---|
| `/` | Landing (hero → footer) | ✅ Built |
| `/features` | Feature deep-dive | ✅ Built |
| `/pricing` | Plans & pricing | ✅ Built |
| `/security` | Security & trust (multi-tenancy, isolation) | ✅ Built |
| `/about` | About / story | ✅ Built |
| `/contact` | Contact / book a demo | ✅ Built (form stub) |
| `/blog` | Blog | 🔒 Coming Soon |
| `/docs` | Product docs | 🔒 Coming Soon |
| `/legal/privacy` · `/legal/terms` | Legal | ✅ Built |

### 8.2 App sidebar (`app.brainstack.space`)

Grouped nav (Kyro-style grouped sidebar). Icon = lucide.

**Workspace**
| Item | Icon | Route | Phase 1 | Role |
|---|---|---|---|---|
| Dashboard | `LayoutDashboard` | `/dashboard` | 🔒 preview (static) | all |
| Ask BrainStack | `MessageSquare` | `/ask` | 🔒 Coming Soon | all |

**Knowledge**
| Item | Icon | Route | Phase 1 | Role |
|---|---|---|---|---|
| Library | `Library` | `/knowledge` | 🔒 Coming Soon | all |
| Add Sources | `Upload` | `/knowledge/add` | 🔒 Coming Soon | admin |
| Ingestion | `Workflow` | `/knowledge/ingestion` | 🔒 Coming Soon | admin |

**Intelligence**
| Item | Icon | Route | Phase 1 | Role |
|---|---|---|---|---|
| Agent Trace | `Sparkles` | `/agent/trace` | 🔒 Coming Soon | all |
| Memory | `Brain` | `/agent/memory` | 🔒 Coming Soon | all |

**Operations**
| Item | Icon | Route | Phase 1 | Role |
|---|---|---|---|---|
| Connections (MCP) | `Cable` | `/connections` | 🔒 Coming Soon | manager, admin |
| Actions · Tickets | `Ticket` | `/actions/tickets` | 🔒 Coming Soon | manager, admin |
| Actions · Analytics | `BarChart3` | `/actions/analytics` | 🔒 Coming Soon | manager, admin |

**Insights**
| Item | Icon | Route | Phase 1 | Role |
|---|---|---|---|---|
| Analytics (LLMOps) | `LineChart` | `/analytics` | 🔒 Coming Soon | admin |
| Evaluation | `ClipboardCheck` | `/evaluation` | 🔒 Coming Soon | admin |
| Observability | `Activity` | `/observability` | 🔒 Coming Soon | admin |

**Admin**
| Item | Icon | Route | Phase 1 | Role |
|---|---|---|---|---|
| Team & Roles | `Users` | `/team` | 🔒 Coming Soon | admin |
| Settings | `Settings` | `/settings/general` | ⚙️ partial (Appearance live) | all/admin |

**Topbar (always present):** workspace switcher (tenant) · global search / `⌘K` command palette ·
notifications bell 🔒 · help · **user avatar menu** (account, theme, sign out).

**Settings sub-nav (tabs inside `/settings`):**
General · Members · Connections · Models & cost · **Appearance (✅ live)** · Billing 🔒 ·
API keys 🔒 · Account.

---

## 9. Landing page spec (`brainstack.space`)

A single scrolling page, compact and premium, that sells the platform *and* teaches its core
idea (RAG to *know*, MCP to *do*). Sections top-to-bottom:

1. **Nav (sticky, minimal).** BrainMark + wordmark left; `Features · Pricing · Security · Docs
   (soon)` center; `Log in` (ghost) + `Get started` (accent) right. Collapses to a sheet on
   mobile.
2. **Hero.** Big display headline — *"Your company's second brain — fully stacked."* Sub:
   one-liner from `PROJECT_IDEA.md`. Two CTAs (`Start free` accent, `Book a demo` outline). A
   tasteful product mock/gradient panel on the right (a stylized Ask + Trace panel screenshot,
   even if faked). Subtle `fade-up` entrance.
3. **Trust strip.** "Isolated per company · Grounded & cited · Role-based actions" as three quiet
   pills. (Logo cloud placeholder → *Coming Soon*.)
4. **How it works (3 steps).** Ingest → Ask → Act. Icon tiles + short copy. Mirrors the three
   journeys in `PROJECT_IDEA.md §4`.
5. **The core idea callout.** *"RAG lets it **know**. MCP lets it **do**."* — a two-column split
   visual. This is the memorable, differentiating message.
6. **Feature grid.** 6–8 cards (Kyro `AutomationCard` styling): Grounded Q&A, Live Agent Trace,
   Inline Citations, Multi-source Ingestion, Role-based Actions (MCP), Analytics & Eval,
   Multi-tenancy, Observability. Each card: icon tile, eyebrow category, title, one-line desc.
7. **Agent trace teaser.** A stylized live-trace animation (`Planning → Searching docs → Company
   MCP → Drafting`) — the "wow" surface, as marketing.
8. **Security & isolation.** Namespaces-per-tenant, JWT-scoped, "your data never trains a model"
   — links to `/security`.
9. **Pricing preview.** 3 tiers (Starter / Team / Enterprise) — placeholder numbers, "Contact
   us" on Enterprise. Full detail on `/pricing`.
10. **FAQ.** Accordion: "Is my data isolated?", "Do you train on my docs?", "What can managers
    do that employees can't?", "What's MCP?" — reuse the guide's crisp answers.
11. **Final CTA band.** Accent-tinted band, headline + `Get started`.
12. **Footer.** Columns: Product · Company · Resources (Docs/Blog soon) · Legal. BrainMark +
    copyright + socials (stubs).

> **Tone:** confident, technical-but-clear. It should read like a real Series-A AI SaaS, because
> that's the bar the design system sets.

---

## 10. App shell spec (`app.brainstack.space`)

The persistent frame every authenticated page renders inside.

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOPBAR:  [🧠 BrainStack ▸ Acme Corp ▾]   ⌘K search…      🔔  ?   (AV▾) │
├───────────────┬──────────────────────────────────────────────────────┤
│  SIDEBAR      │                                                        │
│  (grouped)    │   BREADCRUMB  ›  Page title                            │
│               │   ─────────────────────────────────────────────────   │
│  Workspace    │                                                        │
│   Dashboard   │        page content / ComingSoon preview               │
│   Ask     🔒  │                                                        │
│  Knowledge    │                                                        │
│   Library 🔒  │                                                        │
│   ...         │                                                        │
│  Intelligence │                                                        │
│  Operations   │                                                        │
│  Insights     │                                                        │
│  Admin        │                                                        │
│   Settings    │                                                        │
│               │                                                        │
│  [◀ collapse] │                                                        │
└───────────────┴──────────────────────────────────────────────────────┘
```

- **Sidebar:** grouped items (§8.2) with lucide icons + `LockBadge`. Active item = solid-primary
  pill (Kyro active-nav style). **Collapsible** to icon-only (state in `stores/ui.ts`,
  persisted). RBAC: items whose `role` the current (mock) user lacks are hidden entirely — this
  is where you *demonstrate* the RBAC story from the guide even before it's wired.
- **Topbar:** tenant switcher (mock list), `⌘K` command palette (fuzzy-jump to any page), notif
  bell (🔒), help, avatar menu (Account, Appearance, Sign out).
- **Command palette (`⌘K`):** lists every route with its lock state; great for demoing the whole
  IA fast. Built in Phase 1 because it's pure UI.
- **Responsive:** sidebar → slide-over sheet under `lg`; topbar condenses; content full-width.
- **Role simulator (dev aid):** a tiny switcher in the avatar menu to flip the *mock* role
  (employee/manager/admin) so you can watch nav items appear/disappear — sells RBAC in the demo.

---

## 11. Feature pages — every screen, one by one

Each page ships in Phase 1 as a **`<ComingSoon>` preview** (per §7) *unless marked live*. The
"eventual layout" notes below double as the spec for when the backend phase lands, and as the
**dimmed preview mock** shown behind the Coming Soon card.

### 11.1 Auth & onboarding *(UI live; wiring later)*
- **Login / Sign up / Forgot / Invite:** centered auth surface on `--color-canvas`, single card
  on `--color-surface`, BrainMark, Kyro `scale-in`/`fade-up` entrance. Sign up = **create company
  (tenant)** + admin user. Real form validation (zod), submit is stubbed/mock.
- **Onboarding:** 3-step stepper — name your workspace → invite teammates (emails) → "add your
  first source" (routes to Knowledge, which is 🔒). Pure UI.

### 11.2 Dashboard `/dashboard` *(static preview)*
- **Eventual:** KPI tiles (questions asked, docs indexed, avg faithfulness, spend today), recent
  activity, quick actions (Ask, Add source). **Phase 1:** the layout with **skeleton/placeholder
  numbers** and a subtle "sample data" ribbon — the most "alive"-feeling locked page.

### 11.3 Ask BrainStack `/ask` 🔒 *(the crown jewel)*
- **Eventual layout:** three-pane — (left) conversation list, (center) chat with token streaming +
  inline `[1]` citations, (right) **Live Agent Trace panel** (`Planning → Knowledge → Web →
  Drafting`) and a **citation side-panel** (Tier-2: PDF page + retrieved passage). Unlocks in
  **Backend Phase 3–5**. Preview mock shows all three panes greyed.

### 11.4 Knowledge
- **Library `/knowledge` 🔒:** table/grid of sources — filename, type, status badge ("Ready"),
  chunk count, added date, row actions. Unlocks **Backend Phase 2**.
- **Add Sources `/knowledge/add` 🔒:** dropzone (PDF/Word), "paste a URL", "connect a source"
  tiles. Unlocks **Backend Phase 2**.
- **Ingestion `/knowledge/ingestion` 🔒:** the live pipeline view — `Extracting → Chunking →
  Embedding (312/312) → Indexing ✅` with a `Progress` bar per doc. Preview shows a paused,
  greyed pipeline. Unlocks **Backend Phase 2**.

### 11.5 Intelligence
- **Agent Trace `/agent/trace` 🔒:** full-screen timeline of agent steps (node + tool events,
  latency per step). Unlocks **Backend Phase 4**.
- **Memory `/agent/memory` 🔒:** short-term (conversation window) + long-term (extracted facts)
  viewers. Unlocks **Backend Phase 6**.

### 11.6 Operations *(manager/admin only)*
- **Connections (MCP) `/connections` 🔒:** cards for the **Company MCP Server** — connection
  status, discovered tools (`assign_ticket`, `list_tickets`, `get_analytics`), transport
  (`streamable-http`), and a **role banner** ("Your role connects to the Company system" vs "not
  connected"). This page *is* the RBAC/MCP story visualized. Unlocks **Backend Phase 5**.
- **Tickets `/actions/tickets` 🔒:** list/assign tickets (via MCP). Unlocks **Backend Phase 5**.
- **Actions Analytics `/actions/analytics` 🔒:** employee workload/analytics (via MCP). Unlocks
  **Backend Phase 5**.

### 11.7 Insights *(admin)*
- **Analytics (LLMOps) `/analytics` 🔒:** cost/day, p50/p95 latency, tokens, faithfulness over
  time, tool-usage breakdown, top questions. Charts (dataviz-styled). Unlocks **Backend Phase 7**.
- **Evaluation `/evaluation` 🔒:** golden dataset table, LLM-as-judge results
  (`faithful / relevance`), RAGAS comparison, run history. Unlocks **Backend Phase 7**.
- **Observability `/observability` 🔒:** per-request traces (LangSmith-style), filter by
  tenant/user/tool. Unlocks **Backend Phase 7**.

### 11.8 Admin
- **Team & Roles `/team` 🔒:** members table (name, email, role admin/employee/manager, status),
  invite flow, role editor — the RBAC control panel. Unlocks with backend auth.
- **Settings `/settings/*`:**
  - **General 🔒:** workspace name, logo, defaults.
  - **Members 🔒:** mirrors Team.
  - **Connections 🔒:** MCP server URL per tenant, secrets.
  - **Models & cost 🔒:** pick model per task (haiku/sonnet/opus), token ceilings, embedding
    provider — the cost-discipline controls from the guide, as UI.
  - **Appearance ✅ LIVE:** the **theme/accent picker**. Choosing a preset or a custom accent
    rewrites the CSS tokens on `:root` live and persists to `stores/theme.ts`. **This page
    proves the whole "change everything globally" design system.** Ships fully working in Phase 1.
  - **Billing 🔒 / API keys 🔒 / Account (✅ profile UI).**

---

## 12. Component inventory

| Component | Home | Notes |
|---|---|---|
| `Button` | `ui/` | variants: primary(ink), accent, outline, ghost, danger; sizes sm/md |
| `Card` | `ui/` | `rounded-2xl border-border bg-surface shadow-sm`, hover-lift variant |
| `Badge` | `ui/` | neutral / accent / success / warning / danger / **lock** |
| `Input`,`Textarea`,`Select`,`Switch` | `ui/` | tokenized form controls (rhf + zod) |
| `Tabs` / `PillTabs` / `SegmentedControl` | `ui/` | settings & filter rows |
| `Table` | `ui/` | library, members, eval, tickets |
| `Modal` | `ui/` | Kyro pattern (Esc/backdrop close, sticky footer) |
| `Toast` | `ui/` | Kyro bottom-right stack + countdown bar |
| `Tooltip`,`Dropdown`,`Avatar` | `ui/` | topbar & menus |
| `Skeleton` | `ui/` | loading/placeholder everywhere |
| `Progress` | `ui/` | ingestion preview |
| `KpiTile` | `ui/` | dashboard/analytics stat tiles |
| `EmptyState` | `patterns/` | zero-data states |
| `ComingSoon` | `patterns/` | ⭐ the locked-page preview (§7) |
| `LockBadge` | `patterns/` | 🔒 nav marker |
| `PagePreview` | `patterns/` | dimmed/blurred mock behind ComingSoon |
| `Sidebar`,`Topbar`,`CommandPalette` | `layout/` | app shell |
| `MarketingNav`,`Footer` | `layout/` | public frame |
| `Hero`,`FeatureGrid`,`PricingTable`,`FAQ`,`TraceTeaser` | `marketing/` | landing sections |
| `Logo` / `BrainMark` | `brand/` | 🧠 wordmark, `currentColor` |

---

## 13. Supabase & environment setup

Phase 1 is frontend-only, so Supabase isn't *load-bearing* yet — but we provision it and wire env
so backend phases plug in cleanly.

- **Create a Supabase project** (free tier). Note the **connection string** (Postgres) — this is
  what the **FastAPI backend** (guide's phases) will use via SQLAlchemy. We are **not** using
  Supabase Auth; auth stays **custom FastAPI JWT** per `PROJECT_GUIDE.md §Phase 0`.
- **What Supabase is for here:** the managed **Postgres** that holds tenants, users, roles,
  documents, chunk metadata, and the `query_traces` table (guide §2.16). **Vectors live in
  Pinecone, not Supabase.**
- **Env vars (in Vercel project settings + local `.env.local`):**

```bash
# Frontend (Phase 1)
NEXT_PUBLIC_APP_URL=https://app.brainstack.space
NEXT_PUBLIC_MARKETING_URL=https://brainstack.space
NEXT_PUBLIC_API_URL=            # FastAPI base URL — filled when backend deploys

# Prepared for backend phases (NOT used by the Next app directly)
DATABASE_URL=postgresql://...   # Supabase connection string
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

> **Backend hosting (later, not Phase 1):** Vercel can't run the long-lived FastAPI + Redis + MCP
> server. When you reach the guide's Phase 2+, host those on **Railway / Render / Fly**, point
> `NEXT_PUBLIC_API_URL` at it, and keep **Supabase** as the Postgres. Nothing in Phase 1 blocks
> on this.

---

## 14. Phase 1 build checklist & order

Do it in this order — each step is independently reviewable via a Vercel preview URL.

1. **Scaffold.** `web/` Next.js + TS + Tailwind v4 + shadcn init. Self-host Inter via `next/font`.
2. **Design tokens.** Write `app/globals.css` `@theme` (§6.2). This comes *first* — everything
   consumes it.
3. **Core `ui/` primitives.** Button, Card, Badge, Input, Modal, Tabs, Table, Toast, Skeleton,
   KpiTile — all tokenized. Build a throwaway `/kitchen-sink` page to eyeball them.
4. **Patterns.** `ComingSoon`, `LockBadge`, `PagePreview`, `EmptyState`.
5. **`lib/nav.ts`.** The route + icon + lock + role registry (§7.1, §8.2). Single source.
6. **Routing & middleware.** Route groups `(marketing) / (auth) / (app)`; `middleware.ts` for
   host-based subdomain routing (prod) + path fallback (dev).
7. **App shell.** `Sidebar` (grouped, collapsible, RBAC-filtered, lock badges) + `Topbar` +
   `CommandPalette` + role simulator.
8. **All app pages.** Generate every route from `nav.ts`; each renders `ComingSoon` (or its
   static preview) per §11. Dashboard gets the "sample data" treatment.
9. **Appearance settings (LIVE).** The theme/accent picker that rewrites `:root` tokens — the
   proof of the global design system.
10. **Auth & onboarding UI.** Login/Signup/Forgot/Invite/Onboarding screens (validation real,
    submit stubbed).
11. **Marketing site.** Landing (all §9 sections) + Features, Pricing, Security, About, Contact,
    Legal; Blog/Docs as Coming Soon.
12. **Polish pass.** Responsive from 360px, focus states, `prefers-reduced-motion`, empty/skeleton
    states, favicon + OG image + metadata.
13. **Deploy.** Vercel project, attach `brainstack.space` + `app.brainstack.space`, DNS, HTTPS.
    Set env vars. Verify both subdomains route correctly.

---

## 15. Definition of done

Phase 1 is complete when:

- [ ] `brainstack.space` serves a **polished, responsive marketing site**, live over HTTPS.
- [ ] `app.brainstack.space` serves the **full app shell**; **every** feature from
      `PROJECT_IDEA.md` has a real page in the nav, each with a **premium *Coming Soon* preview**
      (or live where marked).
- [ ] The **sidebar shows lock badges** and **hides items by (mock) role** — the RBAC story is
      visible and demoable via the role simulator.
- [ ] **Changing one accent ramp / one canvas token restyles the entire product** — verified live
      via the **Appearance** settings page.
- [ ] **No hard-coded colors** exist in components — everything flows from semantic tokens.
- [ ] The design language is **visibly consistent** with the Kyro reference quality bar
      (compact, professional, hairline borders, `rounded-2xl` cards, quiet motion).
- [ ] `⌘K` command palette can jump to **any** page; both subdomains route correctly in prod
      and dev.
- [ ] Supabase project exists and env is wired (dormant until backend phases).

**When this is done, you have a live product people can walk through end-to-end — and from here,
every backend phase in `PROJECT_GUIDE.md` just lights up a page that already exists.**

---

*Next: as each `PROJECT_GUIDE.md` backend phase ships, flip its `locked: false` in `lib/nav.ts`,
replace its `<ComingSoon>` with the real screen, and redeploy. The shell never changes.*
