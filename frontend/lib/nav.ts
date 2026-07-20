/**
 * ⭐ The single source of truth for the product's information architecture.
 *
 * Every app route declares its label, icon, lock state, RBAC visibility and
 * (if locked) which backend phase unlocks it. The Sidebar, Command Palette
 * and breadcrumbs all render from this registry — unlocking a
 * feature later means flipping `locked: false` HERE and replacing its page's
 * <ComingSoon> with the real screen. Nothing else moves.
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Brain,
  Building2,
  Cable,
  ChartColumn,
  ChartLine,
  ClipboardCheck,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  Library,
  MessageSquare,
  Palette,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Upload,
  User,
  Users,
  Workflow,
} from "lucide-react";

export type Role = "employee" | "manager" | "admin";

export const ROLES: Role[] = ["employee", "manager", "admin"];

export type NavGroup =
  | "Workspace"
  | "Knowledge"
  | "Intelligence"
  | "Operations"
  | "Insights"
  | "Admin";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroup;
  /** true → nav shows a lock badge and the page renders a Coming Soon preview. */
  locked: boolean;
  /** Roles that can SEE this item. Undefined = everyone. */
  roles?: Role[];
  /** Which backend phase (PROJECT_GUIDE.md Part 3) makes this page real. */
  unlocksIn?: string;
  /** One-line pitch, reused by Coming Soon pages and the command palette. */
  blurb: string;
};

export const NAV_GROUP_ORDER: NavGroup[] = [
  "Workspace",
  "Knowledge",
  "Intelligence",
  "Operations",
  "Insights",
  "Admin",
];

export const APP_NAV: NavItem[] = [
  // ── Workspace ──────────────────────────────────────────────────────────
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    group: "Workspace",
    locked: true,
    unlocksIn: "Backend Phase 7 · Evaluation & observability",
    blurb:
      "Workspace at a glance — questions asked, documents indexed, quality scores and spend.",
  },
  {
    label: "Ask BrainStack",
    href: "/ask",
    icon: MessageSquare,
    group: "Workspace",
    locked: false,
    blurb:
      "Ask any question and get a grounded, cited answer from your company's knowledge — with a live view of the agent's reasoning.",
  },

  // ── Knowledge ──────────────────────────────────────────────────────────
  {
    label: "Library",
    href: "/knowledge",
    icon: Library,
    group: "Knowledge",
    locked: false,
    blurb:
      "Every source your workspace knows — searchable, with status, chunk counts and previews.",
  },
  {
    label: "Add Sources",
    href: "/knowledge/add",
    icon: Upload,
    group: "Knowledge",
    locked: false,
    roles: ["admin"],
    blurb:
      "Upload PDFs and docs, paste URLs, or connect data sources to grow the knowledge base.",
  },
  {
    label: "Ingestion",
    href: "/knowledge/ingestion",
    icon: Workflow,
    group: "Knowledge",
    locked: false,
    roles: ["admin"],
    blurb:
      "Watch documents move through the pipeline live — extract → chunk → embed → index.",
  },

  // ── Intelligence ───────────────────────────────────────────────────────
  {
    label: "Agent Trace",
    href: "/agent/trace",
    icon: Sparkles,
    group: "Intelligence",
    locked: true,
    unlocksIn: "Backend Phase 4 · The LangGraph agent",
    blurb:
      "The agent's reasoning, step by step — planning, tool calls, latency and cost per step.",
  },
  {
    label: "Memory",
    href: "/agent/memory",
    icon: Brain,
    group: "Intelligence",
    locked: true,
    unlocksIn: "Backend Phase 6 · Memory & advanced RAG",
    blurb:
      "What the assistant remembers — conversation context and durable long-term facts.",
  },

  // ── Operations (manager / admin) ───────────────────────────────────────
  {
    label: "Connections",
    href: "/connections",
    icon: Cable,
    group: "Operations",
    locked: true,
    roles: ["manager", "admin"],
    unlocksIn: "Backend Phase 5 · MCP + RBAC",
    blurb:
      "Your company systems, connected over MCP — discovered tools, transport and role gating.",
  },
  {
    label: "Tickets",
    href: "/actions/tickets",
    icon: Ticket,
    group: "Operations",
    locked: true,
    roles: ["manager", "admin"],
    unlocksIn: "Backend Phase 5 · MCP + RBAC",
    blurb:
      "Real actions in your ticketing system — assign, reassign and track, straight from chat.",
  },
  {
    label: "Workforce Analytics",
    href: "/actions/analytics",
    icon: ChartColumn,
    group: "Operations",
    locked: true,
    roles: ["manager", "admin"],
    unlocksIn: "Backend Phase 5 · MCP + RBAC",
    blurb:
      "Team workload and resolution metrics, pulled live from your company systems via MCP.",
  },

  // ── Insights (admin) ───────────────────────────────────────────────────
  {
    label: "Analytics",
    href: "/analytics",
    icon: ChartLine,
    group: "Insights",
    locked: true,
    roles: ["admin"],
    unlocksIn: "Backend Phase 7 · Evaluation & observability",
    blurb:
      "LLMOps for your workspace — cost per day, latency percentiles, token usage and quality over time.",
  },
  {
    label: "Evaluation",
    href: "/evaluation",
    icon: ClipboardCheck,
    group: "Insights",
    locked: true,
    roles: ["admin"],
    unlocksIn: "Backend Phase 7 · Evaluation & observability",
    blurb:
      "Proof the answers are good — golden dataset runs, faithfulness and retrieval-relevance scores.",
  },
  {
    label: "Observability",
    href: "/observability",
    icon: Activity,
    group: "Insights",
    locked: true,
    roles: ["admin"],
    unlocksIn: "Backend Phase 7 · Evaluation & observability",
    blurb:
      "Per-request traces — what was retrieved, which tools were called, how long and how much.",
  },

  // ── Admin ──────────────────────────────────────────────────────────────
  {
    label: "Team & Roles",
    href: "/team",
    icon: Users,
    group: "Admin",
    locked: true,
    roles: ["admin"],
    unlocksIn: "Backend Phase 0 · Multi-tenant foundation",
    blurb:
      "Members, invites and roles — who can ask, who can act, who administers.",
  },
  {
    label: "Settings",
    href: "/settings/general",
    icon: Settings,
    group: "Admin",
    locked: false,
    blurb: "Workspace configuration — general, members, models, appearance and more.",
  },
];

export type SettingsTab = {
  label: string;
  href: string;
  icon: LucideIcon;
  locked: boolean;
  unlocksIn?: string;
  blurb: string;
};

export const SETTINGS_TABS: SettingsTab[] = [
  {
    label: "General",
    href: "/settings/general",
    icon: Building2,
    locked: true,
    unlocksIn: "Backend Phase 0 · Multi-tenant foundation",
    blurb: "Workspace name, logo and defaults.",
  },
  {
    label: "Members",
    href: "/settings/members",
    icon: Users,
    locked: true,
    unlocksIn: "Backend Phase 0 · Multi-tenant foundation",
    blurb: "Invite teammates and manage their roles.",
  },
  {
    label: "Connections",
    href: "/settings/connections",
    icon: Cable,
    locked: true,
    unlocksIn: "Backend Phase 5 · MCP + RBAC",
    blurb: "Your Company MCP Server URL and credentials.",
  },
  {
    label: "Models & cost",
    href: "/settings/models",
    icon: SlidersHorizontal,
    locked: true,
    unlocksIn: "Backend Phase 8 · Production polish",
    blurb: "Model selection per task, token ceilings and embedding provider.",
  },
  {
    label: "Appearance",
    href: "/settings/appearance",
    icon: Palette,
    locked: false,
    blurb: "Accent and canvas — restyle the whole product live.",
  },
  {
    label: "Billing",
    href: "/settings/billing",
    icon: CreditCard,
    locked: true,
    unlocksIn: "Later · after launch",
    blurb: "Plan, usage and invoices.",
  },
  {
    label: "API keys",
    href: "/settings/api-keys",
    icon: KeyRound,
    locked: true,
    unlocksIn: "Later · after launch",
    blurb: "Programmatic access to your workspace.",
  },
  {
    label: "Account",
    href: "/settings/account",
    icon: User,
    locked: false,
    blurb: "Your profile and preferences.",
  },
];

export const MARKETING_LINKS: {
  label: string;
  href: string;
  soon?: boolean;
}[] = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Security", href: "/security" },
  { label: "Docs", href: "/docs", soon: true },
  { label: "Blog", href: "/blog", soon: true },
];

/** Can `role` see this nav item? */
export function roleAllows(item: { roles?: Role[] }, role: Role): boolean {
  return !item.roles || item.roles.includes(role);
}

/** Active-state matcher: exact or a sub-path (settings matches any tab). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href.startsWith("/settings")) return pathname.startsWith("/settings");
  const matches = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  if (!matches(href)) return false;
  // Longest-match wins: /knowledge must NOT light up on /knowledge/add,
  // because the more specific "Add Sources" entry claims that path.
  return !APP_NAV.some(
    (item) => item.href.length > href.length && matches(item.href),
  );
}

/** Find the registry entry for a pathname (used by breadcrumbs / palette). */
export function findNavItem(pathname: string): NavItem | undefined {
  return APP_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
