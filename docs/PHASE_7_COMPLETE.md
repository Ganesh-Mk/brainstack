# ✅ Phase 7 COMPLETE — MCP + RBAC (Backend Phase 5) ⭐⭐

> Shipped 2026-07-20. The differentiator phase: the agent's external boundary
> is now **MCP**, and RBAC works **by capability, not by prompt**.
> Verified locally (20/20 e2e) and in production (20/20 e2e + 14/14
> transport checks), real Claude, both roles.

---

## What exists now

```
┌──────────────────────────────┐        ┌────────────────────────────────────┐
│ api.brainstack.space         │  MCP   │ company-nz3g.onrender.com (NEW)    │
│                              │ (http) │                                    │
│  agent ────────────────────── ┼───────┼→ /mcp  FastMCP, streamable-http    │
│   ├ search_knowledge  NATIVE │        │    assign_ticket                   │
│   ├ web_search        NATIVE │        │    list_tickets                    │
│   └ MCP tools*  ─────────────┘        │    get_analytics                   │
│     *manager/admin sessions only      │  + REST faces (/tickets,           │
│                                       │    /analytics) for the UI pages    │
│  GET /connections                     │  in-memory per-tenant store        │
│  GET /company/tickets   (mgr/admin)   │  (a prop — reseeds on restart)     │
│  GET /company/analytics (mgr/admin)   │  shared-secret + role validation   │
└──────────────────────────────┘        └────────────────────────────────────┘
```

### The two RBAC layers

1. **Capability (the star)** — `agent.assemble_tools(tenant_id, role)`:
   manager/admin sessions discover the Company MCP tools and merge them into
   the agent's tool list. For an employee **no connection is made** — the
   tools don't exist in their session. Not hidden, not refused: absent by
   construction. Pinned by a test:
   `test_employee_session_has_no_mcp_tools` asserts the employee toolset is
   native-only AND that discovery was never even called.
2. **Server-side validation** — every MCP/REST call carries
   `X-Tenant-Id` / `X-Role` (from `get_current_user()` only, never the
   client) plus `X-MCP-Secret`; the company service re-checks role inside
   every tool. A forged or buggy client still can't act.

### The demo (verified in production, real Claude)

- **Manager:** *"Assign the login-bug ticket to Priya and show me her
  workload."* → trace `🧠 Planning → ⚡ Company MCP · assign_ticket →
  ⚡ Company MCP · get_analytics → 🧠 Reviewing → ✍️ Drafting` → answer
  reports the action **and the Tickets page shows the row changed**.
- **Employee, same ask:** trace `🧠 Planning → ✍️ Drafting`. Answer:
  *"I can't do that from this account — assigning tickets requires manager
  or admin permissions."* Ticket untouched. The refusal is informative
  because the employee's system prompt says actions exist for managers —
  but the capability simply isn't there.

### What was built

| Piece | Where |
|---|---|
| Company Systems service (2nd Render service, root dir `company/`) | `company/app/` — store, REST, FastMCP tools, shared-secret middleware |
| MCP client (official `mcp` SDK — deliberate deviation from langchain-mcp-adapters, see PHASE_7.md) | `backend/app/services/mcp_client.py` — cached discovery (~5 min), per-call sessions, graceful degradation |
| Role-aware agent + `action` trace kind | `backend/app/services/agent.py` |
| `/connections` + manager proxies | `backend/app/routers/company.py`, `require_manager` in `core/deps.py` |
| Connections / Tickets / Workforce Analytics pages (live + demo mode) | `frontend/app/(app)/connections`, `(app)/actions/*`, `hooks/useCompany.ts` |
| Action step styling (⚡ warning tint) + trace badges | `components/ask/TraceSteps.tsx`, `agent/trace/view.tsx` |

Config: `COMPANY_MCP_URL` + `MCP_SHARED_SECRET` (+ `MCP_DISCOVERY_TTL=300`)
on the backend; `MCP_SHARED_SECRET` on the company service. Unset = no MCP:
agent runs native-only, Connections shows disconnected. Nothing breaks.

## Verification

- `backend`: **50/50** tests (10 new: capability assembly, graph action path,
  endpoint gating). `company`: **9/9** (store, REST auth, in-tool role checks).
- Transport script (handshake, discovery, RBAC, tenant isolation, secret
  rejection, REST↔MCP consistency): **14/14 local, 14/14 production**.
- Full e2e (`e2e_phase7.py`, real Claude): **20/20 local, 20/20 production**.

## ⚔️ War stories (production-only failures — the measurement lesson again)

Both appeared ONLY behind Render's proxy; localhost was green the whole time.

1. **307 → 421 on `/mcp`.** Mounting the MCP sub-app at `/mcp` made Starlette
   redirect `POST /mcp` → `/mcp/`; following that redirect through Render's
   proxy failed with 421 Misdirected Request. Fix: the sub-app owns the
   `/mcp` path itself and is mounted at root (last, so REST keeps precedence)
   — no redirect exists anymore.
2. **`Invalid Host header` (421).** The MCP SDK ships DNS-rebinding
   protection that only accepts `localhost` Hosts — it rejected the
   production hostname. It guards browser→localhost attacks, irrelevant for
   a secret-authenticated server-to-server API → disabled explicitly via
   `TransportSecuritySettings(enable_dns_rebinding_protection=False)`.

## 🌐 Browser checklist (app.brainstack.space)

As **your admin account**:
- [ ] **Connections** page (Operations) is unlocked → "Company MCP Server"
      card shows **Connected**, transport `streamable-http`, and the 3
      discovered tools with descriptions.
- [ ] **Tickets** page shows the seeded board (login-bug, checkout-crash, …).
- [ ] **Workforce Analytics** shows Priya/Dev/Sara with workload bars.
- [ ] In **Ask**: *"Assign the login-bug ticket to Priya and show her
      workload"* → the trace panel shows two ⚡ **Company MCP** steps → the
      answer reports what was done (no fake citations).
- [ ] Go to **Tickets** → login-bug now shows **Priya N**, status In progress.
- [ ] **Agent Trace** page: the answer's entry has an **⚡ Action** badge.
- [ ] Avatar menu → simulate role **Employee** → Operations section
      disappears from the sidebar; Connections (via URL) says your role has
      no connection; Tickets/Analytics show "Managers and admins only".
- [ ] Still simulating Employee — ask the same assign question in Ask →
      polite refusal, trace shows only Planning → Drafting (no ⚡).
      *(Note: role simulation only restyles the UI — the agent uses your real
      role, so to see the true employee agent behavior, log in as an invited
      employee account. The e2e verified both for real.)*
- [ ] First manager action after ~15 min idle can take 30–60 s — that's the
      free-tier company service waking up. A prop system may nap.

## How it works (the concepts, in one pass)

1. **MCP is a protocol, not a library.** The company service *declares* its
   tools (name, description, JSON schema); the backend *discovers* them at
   runtime with `list_tools()` and executes with `call_tool()`. Swap the mock
   for Jira tomorrow: change one URL, the agent code never changes.
2. **Discovery IS the security model.** Authorization isn't "the model
   promises not to call it" — it's *which tools get merged into the session*.
   The model can't call what was never in its list. Prompt-level RBAC fails
   to jailbreaks; capability RBAC has nothing to jailbreak.
3. **Native vs MCP tools** (architecture decision #2): knowledge/web search
   stay native — they're the product's core, and the tools node needs their
   raw sources for citations. MCP is for the *external* boundary — other
   systems, other teams, other vendors.
4. **The trace tells the truth.** `action` steps come from the tools node at
   execution time, not from the model's claims — the UI shows what actually
   happened, and the persistence contract stores it with the answer.
