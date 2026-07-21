"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import {
  api,
  ApiError,
  type ApiApiKey,
  type ApiApiKeyCreated,
  type ApiKeyCatalog,
  type ApiKeyEnvironment,
  type ApiKeyUsage,
  isBackendConfigured,
} from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

const DEMO_CATALOG: ApiKeyCatalog = {
  scopes: [
    { scope: "ask:write", description: "Ask questions and get grounded, cited answers." },
    { scope: "search:read", description: "Search the workspace's knowledge without calling a model." },
    { scope: "documents:read", description: "List documents and read ingestion status." },
    { scope: "documents:write", description: "Upload, ingest and delete documents." },
    { scope: "actions:write", description: "Let the agent act in the company's systems over MCP." },
    { scope: "analytics:read", description: "Read this key's own usage and cost." },
  ],
  environments: ["live", "test"],
  default_scopes: ["ask:write", "search:read", "documents:read"],
  default_rate_limit_per_hour: 120,
  max_keys_per_tenant: 20,
};

const DEMO_KEYS: ApiApiKey[] = [
  {
    id: "k1",
    name: "Prod ingest worker",
    environment: "live",
    prefix: "bsk_live",
    last4: "4f2a",
    masked: "bsk_live_••••••••4f2a",
    scopes: ["ask:write", "documents:read", "documents:write"],
    created_by_user_id: "u1",
    created_at: new Date(Date.now() - 21 * 86400e3).toISOString(),
    expires_at: null,
    last_used_at: new Date(Date.now() - 2 * 3600e3).toISOString(),
    revoked_at: null,
    rate_limit_per_hour: 120,
    monthly_cost_cap_usd: 25,
    active: true,
    requests_7d: 1284,
    errors_7d: 6,
    cost_usd_7d: 1.9042,
  },
  {
    id: "k2",
    name: "Staging sandbox",
    environment: "test",
    prefix: "bsk_test",
    last4: "9c7e",
    masked: "bsk_test_••••••••9c7e",
    scopes: ["search:read"],
    created_by_user_id: "u1",
    created_at: new Date(Date.now() - 5 * 86400e3).toISOString(),
    expires_at: null,
    last_used_at: null,
    revoked_at: null,
    rate_limit_per_hour: 60,
    monthly_cost_cap_usd: null,
    active: true,
    requests_7d: 0,
    errors_7d: 0,
    cost_usd_7d: 0,
  },
];

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

function snippet(key: string) {
  return `curl https://api.brainstack.space/v1/ask \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"question": "What is our refund policy?"}'`;
}

export function ApiKeysManager() {
  const demo = !isBackendConfigured;
  const token = useSessionStore((s) => s.token);

  const [keys, setKeys] = useState<ApiApiKey[] | null>(demo ? DEMO_KEYS : null);
  const [catalog, setCatalog] = useState<ApiKeyCatalog | null>(
    demo ? DEMO_CATALOG : null,
  );
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<ApiApiKeyCreated | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<ApiKeyEnvironment>("live");
  const [scopes, setScopes] = useState<string[]>(DEMO_CATALOG.default_scopes);
  const [expiry, setExpiry] = useState("never");
  const [rateLimit, setRateLimit] = useState("120");
  const [costCap, setCostCap] = useState("");

  const [revoking, setRevoking] = useState<ApiApiKey | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, ApiKeyUsage>>({});

  useEffect(() => {
    if (demo || !token) return;
    const t = setTimeout(async () => {
      try {
        const [list, cat] = await Promise.all([
          api.listApiKeys(token),
          api.apiKeyCatalog(token),
        ]);
        setKeys(list);
        setCatalog(cat);
        setScopes(cat.default_scopes);
        setRateLimit(String(cat.default_rate_limit_per_hour));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load API keys.");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [demo, token]);

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  const resetForm = () => {
    setName("");
    setEnvironment("live");
    setScopes(catalog?.default_scopes ?? DEMO_CATALOG.default_scopes);
    setExpiry("never");
    setRateLimit(String(catalog?.default_rate_limit_per_hour ?? 120));
    setCostCap("");
  };

  const create = async () => {
    if (demo || !token) {
      toast("Demo mode", "Minting keys works once your workspace is live.");
      return;
    }
    setBusy(true);
    try {
      const key = await api.createApiKey(token, {
        name: name.trim(),
        environment,
        scopes,
        expires_in_days: expiry === "never" ? null : Number(expiry),
        rate_limit_per_hour: Number(rateLimit) || null,
        monthly_cost_cap_usd: costCap ? Number(costCap) : null,
      });
      setKeys((prev) => [key, ...(prev ?? [])]);
      setCreateOpen(false);
      setCreated(key);
      resetForm();
    } catch (e) {
      toast("Couldn't create key", e instanceof ApiError ? e.message : "Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (key: ApiApiKey) => {
    if (demo || !token) {
      toast("Demo mode", "Revoking works once your workspace is live.");
      setRevoking(null);
      return;
    }
    try {
      const updated = await api.revokeApiKey(token, key.id);
      setKeys((prev) => (prev ?? []).map((k) => (k.id === key.id ? updated : k)));
      toast("Key revoked", `${key.name} stopped working immediately.`);
    } catch (e) {
      toast("Couldn't revoke", e instanceof ApiError ? e.message : "Try again.", "error");
    } finally {
      setRevoking(null);
    }
  };

  const toggleDetail = async (key: ApiApiKey) => {
    const next = openKey === key.id ? null : key.id;
    setOpenKey(next);
    if (next && !usage[key.id] && !demo && token) {
      try {
        const detail = await api.apiKeyUsage(token, key.id);
        setUsage((u) => ({ ...u, [key.id]: detail }));
      } catch {
        /* the row still renders without the drill-down */
      }
    }
  };

  const availableScopes = catalog?.scopes ?? DEMO_CATALOG.scopes;

  return (
    <>
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            API keys
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <KeyRound className="h-3.5 w-3.5" /> Create key
          </Button>
        </div>

        {keys === null && !error ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-muted">{error}</p>
        ) : (keys ?? []).length === 0 ? (
          <p className="p-5 text-sm text-muted">
            No keys yet. Create one to call the API from your own systems.
          </p>
        ) : (
          <ul>
            {(keys ?? []).map((k) => (
              <li key={k.id} className="border-b border-border last:border-0">
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-primary">
                      {k.name}
                      <Badge variant={k.environment === "live" ? "accent" : "neutral"}>
                        {k.environment}
                      </Badge>
                      {!k.active && <Badge variant="danger">revoked</Badge>}
                    </p>
                    <p className="truncate font-mono text-xs text-subtle">
                      {k.masked}
                    </p>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="text-sm text-primary">
                      {k.requests_7d.toLocaleString()}
                    </p>
                    <p className="text-xs text-subtle">calls · 7d</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm text-primary">{usd(k.cost_usd_7d)}</p>
                    <p className="text-xs text-subtle">spend · 7d</p>
                  </div>
                  <div className="hidden text-right md:block">
                    <p className="text-sm text-primary">
                      {k.last_used_at ? timeAgo(k.last_used_at) : "never"}
                    </p>
                    <p className="text-xs text-subtle">last used</p>
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => void toggleDetail(k)}>
                    {openKey === k.id ? "Hide" : "Usage"}
                  </Button>
                  {k.active && (
                    <Button variant="ghost" size="sm" onClick={() => setRevoking(k)}>
                      Revoke
                    </Button>
                  )}
                </div>

                {openKey === k.id && (
                  <div className="space-y-4 border-t border-border bg-surface-raised px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="neutral" className="font-mono">
                          {s}
                        </Badge>
                      ))}
                    </div>
                    <KeyUsagePanel usage={usage[k.id]} demo={demo} keyRow={k} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── create ─────────────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create an API key"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder="Prod ingest worker"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="key-env">Environment</Label>
            <SegmentedControl
              value={environment}
              onChange={(v) => setEnvironment(v as ApiKeyEnvironment)}
              options={[
                { value: "live", label: "Live" },
                { value: "test", label: "Test" },
              ]}
            />
            <p className="mt-1.5 text-xs text-subtle">
              Test keys get their own prefix, quota and cost cap, and their
              traffic is excluded from your quality numbers — but they read and
              write the <span className="font-medium text-muted">same</span>{" "}
              workspace data. There is no separate sandbox.
            </p>
          </div>

          <div>
            <Label>Scopes</Label>
            <div className="space-y-1.5">
              {availableScopes.map((s) => (
                <label
                  key={s.scope}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[var(--color-accent)]"
                    checked={scopes.includes(s.scope)}
                    onChange={(e) =>
                      setScopes((prev) =>
                        e.target.checked
                          ? [...prev, s.scope]
                          : prev.filter((x) => x !== s.scope),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-primary">
                      {s.scope}
                    </span>
                    <span className="block text-xs text-subtle">
                      {s.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {scopes.includes("actions:write") && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This key&apos;s agent will connect to your company systems and
                can take real actions — the same capability a manager has.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="key-expiry">Expires</Label>
              <Select
                id="key-expiry"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              >
                <option value="never">Never</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="key-rate">Requests / hour</Label>
              <Input
                id="key-rate"
                inputMode="numeric"
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="key-cap">Monthly cap (USD)</Label>
              <Input
                id="key-cap"
                inputMode="decimal"
                placeholder="none"
                value={costCap}
                onChange={(e) => setCostCap(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={() => void create()}
            disabled={busy || !name.trim() || scopes.length === 0}
            className="w-full"
          >
            Create key
          </Button>
        </div>
      </Modal>

      {/* ── the one-time reveal ────────────────────────────────────────── */}
      <Modal
        open={created !== null}
        onClose={() => setCreated(null)}
        title="Your new API key"
        size="lg"
      >
        {created && (
          <div className="space-y-4">
            <p className="flex items-start gap-1.5 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Copy it now — this is the only time it will ever be shown. We
              store a hash, so we cannot show it to you again.
            </p>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={created.key}
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copy(created.key, "key")}
              >
                {copied === "key" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="mb-0">Try it</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copy(snippet(created.key), "curl")}
                >
                  {copied === "curl" ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-border bg-surface-raised p-3 font-mono text-xs text-muted">
                {snippet(created.key)}
              </pre>
            </div>

            <Button className="w-full" onClick={() => setCreated(null)}>
              I&apos;ve saved it
            </Button>
          </div>
        )}
      </Modal>

      {/* ── revoke ─────────────────────────────────────────────────────── */}
      <Modal
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Revoke this key?"
      >
        {revoking && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              <span className="font-medium text-primary">{revoking.name}</span>{" "}
              (<span className="font-mono text-xs">{revoking.masked}</span>)
              stops working immediately, everywhere. Anything still using it
              will start getting 401s. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => void revoke(revoking)}
              >
                Revoke key
              </Button>
              <Button variant="outline" onClick={() => setRevoking(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function KeyUsagePanel({
  usage,
  demo,
  keyRow,
}: {
  usage: ApiKeyUsage | undefined;
  demo: boolean;
  keyRow: ApiApiKey;
}) {
  if (demo) {
    return (
      <p className="text-xs text-subtle">
        Per-key usage — calls per day, top endpoints, error rate and spend
        against the cap — appears here once your workspace is live.
      </p>
    );
  }
  if (!usage) return <Skeleton className="h-20 w-full" />;

  const maxReq = Math.max(1, ...usage.per_day.map((d) => d.requests));
  const cap = usage.monthly_cost_cap_usd;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Calls" value={usage.totals.requests.toLocaleString()} />
        <Stat label="Errors" value={usage.totals.errors.toLocaleString()} />
        <Stat label="Questions" value={usage.totals.questions.toLocaleString()} />
        <Stat
          label="This month"
          value={
            cap
              ? `${usd(usage.spend_this_month_usd)} / ${usd(cap)}`
              : usd(usage.spend_this_month_usd)
          }
        />
      </div>

      {usage.per_day.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
            Calls per day · {usage.window_days}d
          </p>
          <div className="flex h-16 items-end gap-1">
            {usage.per_day.map((d) => (
              <div
                key={d.date}
                className="flex-1"
                title={`${d.date}: ${d.requests} calls, ${d.errors} errors`}
              >
                <div
                  className="w-full rounded-t bg-danger/60"
                  style={{ height: `${(d.errors / maxReq) * 64}px` }}
                />
                <div
                  className="w-full rounded-t bg-accent"
                  style={{
                    height: `${((d.requests - d.errors) / maxReq) * 64}px`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {usage.endpoints.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
            Endpoints
          </p>
          <ul className="space-y-1">
            {usage.endpoints.slice(0, 5).map((e) => (
              <li
                key={e.route}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="truncate font-mono text-muted">{e.route}</span>
                <span className="shrink-0 text-subtle">
                  {e.requests.toLocaleString()} ·{" "}
                  {e.p50_ms !== null ? `${e.p50_ms}ms p50` : "—"}
                  {e.errors > 0 && (
                    <span className="text-danger"> · {e.errors} err</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {usage.recent.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
            Recent calls
          </p>
          <ul className="space-y-1">
            {usage.recent.slice(0, 6).map((r) => (
              <li
                key={r.request_id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="truncate font-mono text-muted">
                  {r.method} {r.route}
                </span>
                <span className="shrink-0 text-subtle">
                  <span
                    className={
                      r.status_code >= 400 ? "text-danger" : "text-success"
                    }
                  >
                    {r.status_code}
                  </span>
                  {r.error_code ? ` ${r.error_code}` : ""} · {r.latency_ms}ms ·{" "}
                  {r.created_at ? timeAgo(r.created_at) : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[11px] text-subtle">
            key {keyRow.masked} · quote a request id when reporting a problem
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className="text-sm font-medium text-primary">{value}</p>
    </div>
  );
}
