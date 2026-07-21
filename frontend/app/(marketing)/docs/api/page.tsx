import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "API reference",
  description:
    "Ask, search and ingest programmatically. Scoped keys, per-key quotas and cost caps, and a usage ledger behind every call.",
};

const BASE = "https://api.brainstack.space";

const SCOPES: [string, string][] = [
  ["ask:write", "Ask questions and get grounded, cited answers."],
  ["search:read", "Search the workspace's knowledge without calling a model."],
  ["documents:read", "List documents and read ingestion status."],
  ["documents:write", "Upload, ingest and delete documents."],
  ["actions:write", "Let the agent act in company systems over MCP."],
  ["analytics:read", "Read this key's own usage and cost."],
];

const ENDPOINTS: [string, string, string, string][] = [
  ["GET", "/v1/me", "—", "Introspect the calling key. Needs no scope."],
  ["POST", "/v1/ask", "ask:write", "A grounded, cited answer. JSON or SSE."],
  ["POST", "/v1/search", "search:read", "Retrieval only — no model call."],
  ["GET", "/v1/documents", "documents:read", "List documents and their status."],
  ["GET", "/v1/documents/{id}", "documents:read", "Poll one document until ready."],
  ["POST", "/v1/documents", "documents:write", "Upload a PDF (multipart). 202."],
  ["POST", "/v1/documents/url", "documents:write", "Ingest a web page. 202."],
  ["DELETE", "/v1/documents/{id}", "documents:write", "Remove a document and its vectors."],
  ["GET", "/v1/usage", "analytics:read", "This key's own calls, spend and errors."],
];

const ERRORS: [string, string, string][] = [
  ["401", "invalid_api_key", "Missing, malformed or unknown key."],
  ["401", "key_revoked", "The key was revoked. It will never work again."],
  ["401", "key_expired", "The key passed its expiry date."],
  ["403", "insufficient_scope", "The key lacks the scope this route needs."],
  ["429", "rate_limited", "Over the per-key or per-workspace hourly limit."],
  ["429", "cost_cap_exceeded", "Over this key's monthly spend cap."],
  ["404", "document_not_found", "No such document in this workspace."],
  ["404", "conversation_not_found", "No such conversation for this key."],
  ["503", "model_not_configured", "The answer model isn't configured server-side."],
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-surface-raised p-4 font-mono text-xs leading-6 text-muted">
      {children}
    </pre>
  );
}

function H2({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-xl font-semibold tracking-tight text-primary"
    >
      {children}
    </h2>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Docs
      </Link>

      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-primary">
        API reference
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Ask, search and ingest from your own systems. Every call is scoped,
        rate-limited, cost-capped and recorded — so handing a key to a service
        stays a decision you can audit.
      </p>

      <div className="mt-12 space-y-12">
        <section className="space-y-4">
          <H2 id="quickstart">Quickstart</H2>
          <p className="text-sm leading-6 text-muted">
            Create a key in <span className="text-primary">Settings → API keys</span>.
            It is shown once. Send it as a bearer token.
          </p>
          <Code>{`curl ${BASE}/v1/ask \\
  -H "Authorization: Bearer bsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"question": "What is our refund policy?"}'`}</Code>
          <Code>{`{
  "answer": "Refunds are allowed within 30 days [1].",
  "sources": [
    { "n": 1, "title": "policies-2026", "page": 7,
      "text": "...", "score": 0.87, "source_type": "pdf" }
  ],
  "trace": [ { "n": 1, "kind": "knowledge", "label": "Searching knowledge" } ],
  "usage": { "input_tokens": 3200, "output_tokens": 180,
             "cost_usd": 0.0042, "latency_ms": 4100,
             "first_token_ms": 900, "model": "claude-haiku-4-5" },
  "conversation_id": "…", "trace_id": "…"
}`}</Code>
        </section>

        <section className="space-y-4">
          <H2 id="auth">Authentication</H2>
          <p className="text-sm leading-6 text-muted">
            <code className="font-mono text-xs text-primary">
              Authorization: Bearer bsk_live_…
            </code>{" "}
            on every request. Keys are workspace-scoped: the workspace is
            resolved from the key itself, never from anything you send, so a key
            can only ever reach its own tenant&apos;s data.
          </p>
          <p className="text-sm leading-6 text-muted">
            We store only a SHA-256 hash of your key. If you lose it, revoke it
            and mint another — we genuinely cannot recover it.
          </p>
          <Card className="bg-canvas">
            <p className="text-sm font-medium text-primary">Environments</p>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              <code className="font-mono text-xs">bsk_live_</code> and{" "}
              <code className="font-mono text-xs">bsk_test_</code> keys get
              separate quotas, separate cost caps, and separate usage reporting,
              so test traffic can be excluded from your numbers. They read and
              write the <span className="text-primary">same</span> workspace
              data — this is not a sandbox.
            </p>
          </Card>
        </section>

        <section className="space-y-4">
          <H2 id="scopes">Scopes</H2>
          <p className="text-sm leading-6 text-muted">
            A key carries only the scopes you tick when you create it. Give each
            integration the least it needs.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {SCOPES.map(([scope, desc]) => (
                  <tr key={scope} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-4 align-top font-mono text-xs whitespace-nowrap text-primary">
                      {scope}
                    </td>
                    <td className="py-2.5 text-muted">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm leading-6 text-muted">
            <code className="font-mono text-xs text-primary">actions:write</code>{" "}
            is the one to think about: it gives the key&apos;s agent session the
            same company-system tools a manager has. Without it, those tools are
            never discovered — they do not exist for that key.
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="endpoints">Endpoints</H2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 text-xs font-semibold tracking-wide text-subtle uppercase">
                    Route
                  </th>
                  <th className="py-2 pr-3 text-xs font-semibold tracking-wide text-subtle uppercase">
                    Scope
                  </th>
                  <th className="py-2 text-xs font-semibold tracking-wide text-subtle uppercase">
                    What
                  </th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map(([method, path, scope, what]) => (
                  <tr key={`${method}${path}`} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 align-top font-mono text-xs whitespace-nowrap text-primary">
                      <span className="text-subtle">{method}</span> {path}
                    </td>
                    <td className="py-2.5 pr-3 align-top font-mono text-[11px] whitespace-nowrap text-muted">
                      {scope}
                    </td>
                    <td className="py-2.5 align-top text-muted">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm leading-6 text-muted">
            The full machine-readable schema is at{" "}
            <code className="font-mono text-xs text-primary">
              {BASE}/openapi.json
            </code>
            .
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="search">Search without a model</H2>
          <p className="text-sm leading-6 text-muted">
            <code className="font-mono text-xs text-primary">/v1/search</code>{" "}
            runs the full hybrid retrieval stack — dense vectors, BM25, and
            reciprocal-rank fusion — and returns the passages. No LLM call, so
            it is fast, cheap and deterministic. Use it when you want to bring
            your own model, or to inspect what a question would retrieve.
          </p>
          <Code>{`curl ${BASE}/v1/search \\
  -H "Authorization: Bearer bsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"query": "ERR_4021", "top_k": 5}'`}</Code>
        </section>

        <section className="space-y-4">
          <H2 id="streaming">Streaming</H2>
          <p className="text-sm leading-6 text-muted">
            Pass <code className="font-mono text-xs text-primary">
              &quot;stream&quot;: true
            </code>{" "}
            (or send{" "}
            <code className="font-mono text-xs text-primary">
              Accept: text/event-stream
            </code>
            ) to get server-sent events: <code className="font-mono text-xs">trace</code>,{" "}
            <code className="font-mono text-xs">sources</code>,{" "}
            <code className="font-mono text-xs">delta</code>,{" "}
            <code className="font-mono text-xs">reset</code>,{" "}
            <code className="font-mono text-xs">done</code>.
          </p>
          <p className="text-sm leading-6 text-muted">
            A <code className="font-mono text-xs">reset</code> event means the
            agent&apos;s self-check rejected its own draft and is rewriting —
            discard the text you have rendered so far and keep reading.
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="ingestion">Ingestion is asynchronous</H2>
          <p className="text-sm leading-6 text-muted">
            Uploads return <code className="font-mono text-xs">202</code> with a
            document id. Poll{" "}
            <code className="font-mono text-xs text-primary">
              GET /v1/documents/&#123;id&#125;
            </code>{" "}
            until <code className="font-mono text-xs">status</code> is{" "}
            <code className="font-mono text-xs">ready</code> — it walks{" "}
            <code className="font-mono text-xs">
              queued → extracting → chunking → embedding → ready
            </code>
            , with <code className="font-mono text-xs">chunks_done</code> /{" "}
            <code className="font-mono text-xs">chunk_count</code> for progress.
            Webhooks are not available yet.
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="limits">Limits and caps</H2>
          <p className="text-sm leading-6 text-muted">
            Every key has an hourly request limit and, optionally, a monthly
            spend cap. Rate-limited responses carry{" "}
            <code className="font-mono text-xs">X-RateLimit-Limit</code>,{" "}
            <code className="font-mono text-xs">X-RateLimit-Remaining</code>,{" "}
            <code className="font-mono text-xs">X-RateLimit-Reset</code> and{" "}
            <code className="font-mono text-xs">Retry-After</code>. Back off and
            retry; do not spin.
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="errors">Errors</H2>
          <p className="text-sm leading-6 text-muted">
            Every error has the same shape. Branch on{" "}
            <code className="font-mono text-xs text-primary">code</code>, never
            on the prose.
          </p>
          <Code>{`{
  "code": "insufficient_scope",
  "message": "This key lacks the \`documents:write\` scope.",
  "request_id": "8f2c…",
  "required": "documents:write"
}`}</Code>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {ERRORS.map(([status, code, what]) => (
                  <tr key={code} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 align-top font-mono text-xs text-subtle">
                      {status}
                    </td>
                    <td className="py-2.5 pr-4 align-top font-mono text-xs whitespace-nowrap text-primary">
                      {code}
                    </td>
                    <td className="py-2.5 align-top text-muted">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm leading-6 text-muted">
            Every response carries{" "}
            <code className="font-mono text-xs text-primary">X-Request-Id</code>
            . Quote it when something goes wrong — it is one lookup on our side.
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="accountability">What we record</H2>
          <p className="text-sm leading-6 text-muted">
            Every call — including the ones we refuse — is written to a usage
            ledger with its route, status, latency and request id. Answers
            additionally record tokens, cost and the tools the agent used. All
            of it is visible to workspace admins per key, and to the key itself
            at <code className="font-mono text-xs text-primary">/v1/usage</code>.
          </p>
          <p className="text-sm leading-6 text-muted">
            Key creation, scope changes and revocation are written to an
            append-only audit log that nothing can delete.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="neutral">scoped</Badge>
            <Badge variant="neutral">rate limited</Badge>
            <Badge variant="neutral">cost capped</Badge>
            <Badge variant="neutral">instantly revocable</Badge>
            <Badge variant="neutral">audited</Badge>
          </div>
        </section>
      </div>
    </div>
  );
}
