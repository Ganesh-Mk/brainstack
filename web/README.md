# BrainStack — web

The Next.js product surface for **BrainStack** — marketing site
(`brainstack.space`) and app shell (`app.brainstack.space`) in one app.

- **Design system:** `app/globals.css` — two-layer semantic tokens
  (primitives on `:root`, roles in `@theme inline`). Rebrand by editing the
  `REBRAND HERE` block; Settings → Appearance changes it live at runtime.
- **IA registry:** `lib/nav.ts` — every route, icon, lock state and role.
  Unlocking a feature = flip `locked: false` and replace its `<ComingSoon>`.
- **Subdomain routing:** `proxy.ts` (Next 16) keeps marketing paths on the
  apex and app paths on `app.`; no-op on localhost and Vercel previews.

```bash
npm install
npm run dev     # http://localhost:3000  (marketing at /, app at /dashboard)
npm run build
```

See `../PHASE_1.md` for the full spec and `../PROJECT_GUIDE.md` for the
backend phases that progressively unlock the locked pages.
