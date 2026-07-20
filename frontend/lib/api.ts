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
  kind: "planning" | "knowledge" | "web" | "action" | "drafting";
  label: string;
  detail?: string | null;
  ms?: number | null;
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

  // ── Company systems (MCP) ────────────────────────────────────────────────

  connections: (token: string) =>
    request<ApiConnections>("/connections", { token }),

  companyTickets: (token: string) =>
    request<{ tickets: ApiTicket[] }>("/company/tickets", { token }),

  companyAnalytics: (token: string) =>
    request<{ analytics: ApiWorkforceRow[] }>("/company/analytics", { token }),
};

export type AskHandlers = {
  onSources: (sources: ApiSource[]) => void;
  onDelta: (text: string) => void;
  onTrace?: (step: ApiTraceStep) => void;
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
