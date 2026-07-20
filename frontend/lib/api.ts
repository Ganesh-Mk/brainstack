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
};
