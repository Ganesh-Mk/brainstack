import type { Role } from "@/lib/nav";

/**
 * Tiny typed client for the BrainStack FastAPI backend.
 *
 * Demo-mode contract: when NEXT_PUBLIC_API_URL is empty (the deployed Phase 1
 * site, before the backend deploys), `isBackendConfigured` is false and the
 * auth pages keep their original demo behavior. As soon as the env var points
 * at a real API, the same pages become live. This keeps production from ever
 * half-breaking while the backend runs only locally.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(
  /\/$/,
  "",
);

export const isBackendConfigured = API_URL.length > 0;

export type ApiUser = { id: string; email: string; name: string; role: Role };
export type ApiTenant = { id: string; name: string; slug: string };
export type AuthResult = {
  access_token: string;
  token_type: "bearer";
  user: ApiUser;
  tenant: ApiTenant;
};
export type InviteInfo = {
  company_name: string;
  email: string;
  role: Role;
};

/** One workspace this account belongs to (same email, its role there). */
export type ApiWorkspace = { tenant: ApiTenant; role: Role };

export type ApiMember = {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
};

export type ApiModelConfig = {
  answer_model: string;
  utility_model: string;
  embedding_model: string;
  rerank_enabled: boolean;
  rerank_model: string | null;
  hybrid_search: boolean;
  chunk_size: number;
  chunk_overlap: number;
  answer_max_tokens: number;
  agent_max_steps: number;
  rate_limit_per_hour: number;
  prompt_cache: boolean;
  price_input_per_mtok: number;
  price_output_per_mtok: number;
  mcp_connected: boolean;
};

export type DocumentStatus =
  | "queued"
  | "extracting"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

export type ApiDocument = {
  id: string;
  title: string;
  source_type: "pdf" | "url" | "text";
  source_url: string | null;
  status: DocumentStatus;
  error: string | null;
  page_count: number;
  chunk_count: number;
  chunks_done: number;
  created_at: string;
};

/** True while the ingestion pipeline is still working on a document. */
export function isProcessing(status: DocumentStatus): boolean {
  return status !== "ready" && status !== "failed";
}

export type ApiSource = {
  n: number;
  document_id: string;
  title: string;
  page: number;
  text: string;
  score: number;
  /** Absent on messages persisted before these fields existed → treat as pdf. */
  source_type?: "pdf" | "url" | "text";
  source_url?: string | null;
};

export type ApiTraceStep = {
  n: number;
  kind:
    | "planning"
    | "knowledge"
    | "web"
    | "action"
    | "reflection"
    | "drafting";
  label: string;
  detail?: string | null;
  ms?: number | null;
};

export type ApiMemory = {
  id: string;
  content: string;
  conversation_id: string | null;
  created_at: string;
};

// ── Stats (Phase 9 · evaluation & observability) ───────────────────────────

export type ApiToolUsage = {
  knowledge: number;
  web: number;
  action: number;
  reflection: number;
};

export type ApiDashboardStats = {
  documents: number;
  documents_ready: number;
  chunks: number;
  conversations: number;
  memories: number;
  questions_asked: number;
  avg_latency_ms: number | null;
  cost_usd_30d: number;
  tool_usage: ApiToolUsage;
  recent_questions: {
    question: string;
    status: "ok" | "error";
    latency_ms: number | null;
    tool_kinds: string[];
    created_at: string | null;
  }[];
};

export type ApiAnalytics = {
  window_days: number;
  totals: {
    questions: number;
    errors: number;
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
  };
  latency_ms: { p50: number | null; p95: number | null };
  first_token_ms: { p50: number | null; p95: number | null };
  per_day: {
    date: string;
    questions: number;
    errors: number;
    cost_usd: number;
    avg_latency_ms: number | null;
  }[];
  tool_usage: ApiToolUsage;
  top_questions: { question: string; count: number }[];
};

export type ApiQueryTrace = {
  id: string;
  question: string;
  status: "ok" | "error";
  latency_ms: number;
  first_token_ms: number | null;
  tool_kinds: string[];
  source_count: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  model: string;
  created_at: string | null;
};

export type ApiEvalRun = {
  id: string;
  dataset_size: number;
  faithfulness: number;
  relevance: number;
  retrieval_hit: number;
  citation_validity: number;
  model: string;
  notes: string | null;
  per_question:
    | {
        id: number;
        question: string;
        answer: string;
        refused: boolean;
        expect_refusal: boolean;
        faithfulness: number;
        relevance: number;
        retrieval_hit: boolean;
        citation_valid: boolean;
      }[]
    | null;
  created_at: string | null;
};

// ── Company systems (Phase 7 · MCP + RBAC) ─────────────────────────────────

export type ApiConnections = {
  server: string;
  transport: string;
  configured: boolean;
  role: Role;
  /** Whether this session's ROLE gets the company tools at all. */
  capable: boolean;
  /** True when the tools were actually discovered for this session. */
  connected: boolean;
  tools: { name: string; description: string }[];
};

export type ApiTicket = {
  id: string;
  key: string;
  title: string;
  status: "open" | "in_progress" | "closed";
  assignee: string | null;
  priority: "high" | "medium" | "low";
  updated_at: string;
};

export type ApiWorkforceRow = {
  name: string;
  title: string;
  open: number;
  in_progress: number;
  closed_this_month: number;
  avg_resolution_hours: number;
};

export type ApiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: ApiSource[] | null;
  trace?: ApiTraceStep[] | null;
  created_at: string;
};

export type ApiConversation = {
  id: string;
  title: string;
  question_count: number;
  created_at: string;
  updated_at: string;
};

export type ApiConversationDetail = ApiConversation & {
  messages: ApiMessage[];
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    formData?: FormData;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  // FormData sets its own multipart boundary — never set Content-Type for it.
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.formData ??
        (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
      else if (Array.isArray(data?.detail) && data.detail[0]?.msg)
        detail = data.detail[0].msg; // pydantic validation error
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  signup: (body: {
    company_name: string;
    name: string;
    email: string;
    password: string;
  }) => request<AuthResult>("/auth/signup", { method: "POST", body }),

  login: (body: { email: string; password: string }) =>
    request<AuthResult>("/auth/login", { method: "POST", body }),

  me: (token: string) =>
    request<{ user: ApiUser; tenant: ApiTenant }>("/auth/me", { token }),

  inviteInfo: (token: string) =>
    request<InviteInfo>(`/auth/invites/${token}`),

  acceptInvite: (token: string, body: { name: string; password: string }) =>
    request<AuthResult>(`/auth/invites/${token}/accept`, {
      method: "POST",
      body,
    }),

  createInvite: (token: string, body: { email: string; role: Role }) =>
    request<{ token: string; email: string; role: Role; expires_at: string }>(
      "/auth/invites",
      { method: "POST", body, token },
    ),

  listMembers: (token: string) =>
    request<ApiMember[]>("/auth/members", { token }),

  updateMemberRole: (token: string, id: string, role: Role) =>
    request<ApiMember>(`/auth/members/${id}`, {
      method: "PATCH",
      body: { role },
      token,
    }),

  removeMember: (token: string, id: string) =>
    request<void>(`/auth/members/${id}`, { method: "DELETE", token }),

  renameTenant: (token: string, name: string) =>
    request<ApiTenant>("/auth/tenant", { method: "PATCH", body: { name }, token }),

  // ── Workspaces (one email, many tenants) ─────────────────────────────────

  listWorkspaces: (token: string) =>
    request<ApiWorkspace[]>("/auth/workspaces", { token }),

  createWorkspace: (token: string, name: string) =>
    request<AuthResult>("/auth/workspaces", {
      method: "POST",
      body: { name },
      token,
    }),

  switchWorkspace: (token: string, tenantId: string) =>
    request<AuthResult>(`/auth/workspaces/${tenantId}/switch`, {
      method: "POST",
      token,
    }),

  modelConfig: (token: string) =>
    request<ApiModelConfig>("/stats/config", { token }),

  // ── Knowledge / documents ────────────────────────────────────────────────

  listDocuments: (token: string) =>
    request<ApiDocument[]>("/documents", { token }),

  getDocument: (token: string, id: string) =>
    request<ApiDocument>(`/documents/${id}`, { token }),

  uploadDocument: (token: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<ApiDocument>("/documents", {
      method: "POST",
      token,
      formData,
    });
  },

  ingestUrl: (token: string, url: string) =>
    request<ApiDocument>("/documents/url", {
      method: "POST",
      token,
      body: { url },
    }),

  deleteDocument: (token: string, id: string) =>
    request<void>(`/documents/${id}`, { method: "DELETE", token }),

  /** The stored PDF as a blob (auth'd) — for the citation viewer. */
  fetchDocumentFile: async (token: string, id: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/documents/${id}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      let detail = "Couldn't load the document.";
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        /* keep default */
      }
      throw new ApiError(res.status, detail);
    }
    return res.blob();
  },

  // ── Conversations / grounded Q&A ─────────────────────────────────────────

  listConversations: (token: string) =>
    request<ApiConversation[]>("/conversations", { token }),

  createConversation: (token: string) =>
    request<ApiConversation>("/conversations", { method: "POST", token }),

  getConversation: (token: string, id: string) =>
    request<ApiConversationDetail>(`/conversations/${id}`, { token }),

  deleteConversation: (token: string, id: string) =>
    request<void>(`/conversations/${id}`, { method: "DELETE", token }),

  // ── Long-term memory (Phase 8) ───────────────────────────────────────────

  listMemories: (token: string) => request<ApiMemory[]>("/memories", { token }),

  deleteMemory: (token: string, id: string) =>
    request<void>(`/memories/${id}`, { method: "DELETE", token }),

  // ── Company systems (MCP) ────────────────────────────────────────────────

  connections: (token: string, refresh = false) =>
    request<ApiConnections>(
      refresh ? "/connections?refresh=true" : "/connections",
      { token },
    ),

  companyTickets: (token: string) =>
    request<{ tickets: ApiTicket[] }>("/company/tickets", { token }),

  companyAnalytics: (token: string) =>
    request<{ analytics: ApiWorkforceRow[] }>("/company/analytics", { token }),

  // ── Stats (Phase 9) ──────────────────────────────────────────────────────

  statsDashboard: (token: string) =>
    request<ApiDashboardStats>("/stats/dashboard", { token }),

  statsAnalytics: (token: string) =>
    request<ApiAnalytics>("/stats/analytics", { token }),

  statsTraces: (token: string) =>
    request<{ traces: ApiQueryTrace[] }>("/stats/traces", { token }),

  statsEvals: (token: string) =>
    request<{ runs: ApiEvalRun[] }>("/stats/evals", { token }),
};

export type AskHandlers = {
  onSources: (sources: ApiSource[]) => void;
  onDelta: (text: string) => void;
  onTrace?: (step: ApiTraceStep) => void;
  /** Phase 8 reflection rejected the draft — clear the streamed text; a
   * rewritten answer streams next. */
  onReset?: () => void;
  onDone: (ids: { user_message_id: string; assistant_message_id: string }) => void;
  onError: (message: string) => void;
};

/**
 * Stream a grounded answer over SSE. Uses fetch + ReadableStream because
 * EventSource can't send the Authorization header. Event order from the
 * backend: `sources` (before any token) → `delta`* → `done` | `error`.
 */
export async function streamAsk(
  token: string,
  conversationId: string,
  content: string,
  handlers: AskHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ content }),
    });
  } catch {
    handlers.onError("Can't reach the server. Is the backend running?");
    return;
  }

  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* keep default */
    }
    handlers.onError(detail);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (frame: string) => {
    let event = "";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (!event || !data) return;
    try {
      const parsed = JSON.parse(data);
      if (event === "sources") handlers.onSources(parsed);
      else if (event === "trace") handlers.onTrace?.(parsed);
      else if (event === "reset") handlers.onReset?.();
      else if (event === "delta") handlers.onDelta(parsed.text);
      else if (event === "done") handlers.onDone(parsed);
      else if (event === "error") handlers.onError(parsed.detail);
    } catch {
      /* skip malformed frame */
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    frames.forEach(dispatch);
  }
  if (buffer.trim()) dispatch(buffer);
}
