import type { Metadata } from "next";
import { Server } from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { Ph, PreviewCard } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "Connection settings" };

function ConnectionsPreview() {
  return (
    <PreviewCard className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary">
          <Server className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold text-primary">Company MCP Server</p>
      </div>
      <div>
        <p className="text-xs font-medium text-primary">Server URL</p>
        <div className="mt-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2 font-mono text-xs text-muted">
          https://mcp.your-company.example
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-primary">Auth token</p>
        <Ph className="mt-1.5 h-9 w-full" />
      </div>
      <div className="flex gap-2">
        <Ph className="h-9 w-28 bg-primary/80" />
        <Ph className="h-9 w-28" />
      </div>
    </PreviewCard>
  );
}

export default function ConnectionSettingsPage() {
  return (
    <ComingSoon
      href="/settings/connections"
      bullets={[
        "Point BrainStack at your Company MCP Server — one URL",
        "Credentials stored per workspace, never shared across tenants",
        "Test the connection and see discovered tools before enabling",
      ]}
      preview={<ConnectionsPreview />}
    />
  );
}
