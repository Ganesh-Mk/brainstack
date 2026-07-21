import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Connecting your systems (MCP)",
  description:
    "Stand up a Company MCP Server over streamable-http, authenticate it with a shared secret, and gate its tools by role.",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 text-xl font-semibold tracking-tight text-primary">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-6 text-muted">{children}</p>;
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface-raised p-4 font-mono text-xs leading-6 text-muted">
      {children}
    </pre>
  );
}

export default function McpDocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Docs
      </Link>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-primary">
        Connecting your systems (MCP)
      </h1>
      <p className="mt-4 text-base leading-7 text-muted">
        BrainStack&apos;s agent reaches your company systems — ticketing,
        workforce analytics, whatever you expose — over the open{" "}
        <a
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent hover:underline"
        >
          Model Context Protocol
        </a>
        . A new integration is a new server URL, not new BrainStack code.
      </p>

      <H2>The shape of a Company MCP Server</H2>
      <P>
        One HTTP service, speaking MCP over the{" "}
        <strong className="text-primary">streamable-http</strong> transport at
        a single endpoint (we use{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">
          /mcp
        </code>
        ), stateless per call. It advertises tools; BrainStack discovers them
        and lets the agent call them mid-answer. Our reference server exposes
        three:
      </P>
      <Code>{`list_tickets    — list support/engineering tickets, filter by assignee
assign_ticket   — assign or reassign a ticket to an employee   (mutating)
get_analytics   — workload and resolution metrics for the team`}</Code>
      <P>
        Build yours with any MCP SDK (the official Python{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">
          mcp
        </code>{" "}
        package&apos;s FastMCP, for instance) — if it serves streamable-http
        and lists tools, it plugs in.
      </P>

      <H2>Authentication: a shared secret, server-to-server</H2>
      <P>
        The browser never talks to your MCP server and never holds its secret.
        Every request comes from the BrainStack backend and carries three
        headers your server must validate:
      </P>
      <Code>{`X-MCP-Secret:  <shared secret>     reject the request if it doesn't match
X-Tenant-Id:   <workspace id>      scope every read and write to this tenant
X-Role:        <employee|manager|admin>`}</Code>
      <P>
        Validate the secret on every call, scope all data by{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">
          X-Tenant-Id
        </code>
        , and re-check{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">
          X-Role
        </code>{" "}
        before any mutating tool — defense in depth, even though BrainStack
        already gates by role upstream.
      </P>

      <H2>Role gating — absent by construction</H2>
      <P>
        When a <strong className="text-primary">manager or admin</strong> asks
        a question, their agent session discovers your server&apos;s tools and
        can act with them. An{" "}
        <strong className="text-primary">employee&apos;s</strong> session
        never connects to the server at all — the action tools don&apos;t
        exist in their agent&apos;s world. Not blocked by a prompt that could
        be talked around; absent by construction. The same rule applies to API
        keys: only keys granted the{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">
          actions:write
        </code>{" "}
        scope get tools discovered (see the{" "}
        <Link href="/docs/api" className="font-medium text-accent hover:underline">
          API reference
        </Link>
        ).
      </P>

      <H2>Discovery and health</H2>
      <P>
        BrainStack discovers your tool catalog and caches it for about five
        minutes; the <strong className="text-primary">Connections</strong>{" "}
        page shows exactly what the current session sees, and its Refresh
        button re-discovers on demand — waking a sleeping server first if
        yours idles. Keep an unauthenticated{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">
          /health
        </code>{" "}
        endpoint next to{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">
          /mcp
        </code>{" "}
        for that.
      </P>

      <H2>Wiring it up</H2>
      <P>Two settings on the BrainStack backend connect your server:</P>
      <Code>{`COMPANY_MCP_URL     = https://your-company-systems.example.com/mcp
MCP_SHARED_SECRET   = <the same secret your server validates>`}</Code>
      <P>
        If they&apos;re unset or your server is unreachable, nothing breaks —
        the agent simply runs with its native tools and Connections shows the
        honest state.
      </P>

      <Card className="mt-12 bg-canvas p-6">
        <p className="text-sm leading-6 text-muted">
          <strong className="text-primary">Design rule worth copying:</strong>{" "}
          the agent&apos;s identity (workspace + role) travels from the
          authenticated session through every hop — the model never decides
          who it is, and your server re-validates what it&apos;s allowed to
          do. Capability comes from construction, not from prompts.
        </p>
      </Card>
    </div>
  );
}
