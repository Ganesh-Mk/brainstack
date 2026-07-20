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

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
};
