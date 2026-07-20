# 🔌 BrainStack — Product Phase 7: MCP + RBAC (Backend Phase 5) ⭐⭐

> **Companion to `PROJECT_GUIDE.md` Part 3 §Phase 5 (6–8 days) and §2.12.**
> The guide calls this **the differentiator**. The agent's *external*
> boundary becomes MCP: one real **Company MCP Server** exposing a company's
> ticketing + workforce systems, the agent as an **MCP client**, and RBAC
> that works by **capability, not by prompt**.
>
> The demo that sells the whole project (guide: *"record it"*):
> a **manager** says *"Assign login-bug to Priya and show her workload"* →
> the agent calls MCP tools and it happens. An **employee** asks the same →
> the agent can't — because `assign_ticket` **does not exist in their
> session**. The Company MCP Server was never connected. Absent by
> construction, not blocked by a prompt.

---

## 1. Goal & definition of done

1. Manager asks the demo question → trace shows
   `🧠 Planning → 🎫 Company MCP · assign_ticket → 📊 Company MCP ·
   get_analytics → ✍️ Drafting`, the ticket is actually reassigned, and the
   **Tickets page shows it**.
2. Employee asks the same → polite "I can't do that" — and the trace shows
   the action tools were never even available.
3. Knowledge + web questions still work exactly as in Phase 6 — **native
   tools stay native** (architecture decision #2; MCP is only the external
   boundary).
4. The **Connections page** unlocks and shows, per role, whether this
   session connects to the Company system and which tools were discovered.

---

## 2. The architecture (guide §2.12, made concrete)

```
┌─────────────────────────┐         ┌──────────────────────────────────┐
│ backend (existing)      │         │ company-systems (NEW service)    │
│                         │  MCP    │                                  │
│  agent ──────────────── ┼─────────┼→ /mcp  FastMCP, streamable-http  │
│   ├ search_knowledge    │ (http)  │    assign_ticket                 │
│   ├ web_search   NATIVE │         │    list_tickets                  │
│   └ MCP tools*   ───────┘         │    get_analytics                 │
│     *managers/admins only         │         │ backed by              │
│                                   │  in-memory mock company store    │
│                                   │  (tickets + employees, seeded    │
│                                   │   per tenant — deliberately dumb)│
└─────────────────────────┘         └──────────────────────────────────┘
```

- **The Company MCP Server runs as its own service** (second Render free
  service) — the point is the *boundary*: a separate system, discovered over
  a standard protocol, swappable without touching agent code.
- **The mock company store is deliberately dumb** (guide: "~1 hour, do not
  gold-plate — it's a prop"): in-memory dicts, seeded per tenant with
  tickets (`login-bug`, …) and employees matching the Team page (Priya, Dev,
  Sara). It resets when the free service sleeps — fine for a prop; noted in
  the UI.
- **Transport**: `streamable-http` — the only transport that fits a
  multi-tenant web backend (guide §1.2 #3; stdio can't spawn per session).

### RBAC — the two layers (defense in depth, per the guide)

1. **Capability layer (the star):** when a session's role is
   `manager`/`admin`, the backend discovers the Company MCP tools and merges
   them into the agent's tool list. For an `employee`, **no connection is
   made** — the tools aren't hidden or refused; they never exist.
2. **Server-side validation:** every MCP call carries the tenant + role in
   authenticated headers (shared secret between the services); the server
   re-checks them — a forged or buggy client still can't act.

### MCP client — one deliberate deviation from the guide

The guide suggests `langchain-mcp-adapters`. Our agent's tools node executes
tools itself (that's how sources/trace accumulate), so the adapters' wrapped
LangChain tools would be unwrapped immediately. Instead: the **official `mcp`
Python SDK** directly — `list_tools()` for discovery, `call_tool()` for
execution. Less magic, and the protocol itself is the lesson. Discovery is
cached (~5 min) so it doesn't cost a round-trip per question.

---

## 3. Build plan

### The new `company/` service (small, single-file-ish FastAPI app)

- In-memory store: per-tenant tickets + employees, seeded on first touch.
- Plain REST endpoints (`GET/POST /tickets`, `GET /analytics/{name}`) — the
  "company system's own API" that the frontend pages read.
- **FastMCP** mounted at `/mcp` exposing `assign_ticket` · `list_tickets` ·
  `get_analytics`, calling the same store; validates the shared secret +
  role headers (action tools require manager/admin).

### Backend (existing service)

- MCP client util (`services/mcp_client.py`): discovery + call, sync-wrapped,
  cached; injects `X-Tenant-Id` / `X-Role` / secret headers.
- Agent: tool list becomes role-aware — native tools for everyone, MCP tools
  merged for managers/admins; tools node routes `mcp:*` calls through the
  client; new trace kind **`action`** ("Company MCP · assign_ticket").
- System prompt: action guidance for managers; employees' prompt says
  actions exist for managers (so its refusal is informative).
- `GET /connections` — connection status + discovered tools for the
  Connections page; thin read-proxies `GET /company/tickets`,
  `GET /company/analytics` (manager/admin) for the two pages.

### Frontend

| Page | Becomes |
|---|---|
| **Connections** 🔓 (manager/admin) | The Phase-1 mock, real: Company MCP card with live status, transport, discovered tools with descriptions — and the role-gating explainer ("an employee's session never connects") |
| **Tickets** 🔓 (manager/admin) | Live ticket board from the company system — the proof surface for the demo: assign via chat, watch the row change |
| **Workforce Analytics** 🔓 (manager/admin) | Per-employee workload/resolution from `get_analytics` |
| Ask trace | New `action` step styling (ticket icon, "Company MCP" label) |

Demo mode: canned data as always.

### Tests

- Company service: seeding, REST, MCP handshake, secret rejection,
  role-validation inside tools (defense in depth).
- Backend: role-aware tool assembly (employee list has NO mcp tools —
  asserted, the phase's thesis in a test); mcp tool execution routed +
  traced; connections endpoint gating; graph path with scripted MCP call.
- Live e2e: the full demo both ways (manager acts; employee can't), ticket
  state verified changed via REST, knowledge/web regression.

---

## 4. What YOU need to do

**One 5-minute task after I build it — a second Render service:**
1. Render → **New → Web Service** → same repo → Root Directory **`company`**,
   Build `pip install -r requirements.txt`, Start
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, Free tier.
2. Env vars on it: `MCP_SHARED_SECRET` (I'll generate a value into `.env`).
3. On the **existing** backend service, add: `COMPANY_MCP_URL`
   (= the new service's URL) and the same `MCP_SHARED_SECRET`.

(Free-tier note: the company service sleeps too — the first manager action
after idle takes an extra ~30–60s while it wakes. A prop system may nap.)

## 5. Out of scope

- Real ticketing integrations (Jira/Linear) — the mock IS the point: swap it
  by changing one URL, agent untouched.
- Memory/reflection/advanced RAG (guide Phase 6), evaluation (Phase 7).
