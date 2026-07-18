import type { Metadata } from "next";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { Ph, PreviewCard } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "API keys" };

function ApiKeysPreview() {
  return (
    <PreviewCard className="space-y-3">
      <div className="flex items-center justify-between">
        <Ph className="h-4 w-40" />
        <Ph className="h-9 w-32 bg-primary/80" />
      </div>
      {[1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border p-3"
        >
          <div className="flex-1 space-y-1.5">
            <Ph className="h-3 w-28" />
            <p className="font-mono text-xs text-subtle">
              bsk_live_••••••••••••{i === 1 ? "4f2a" : "9c7e"}
            </p>
          </div>
          <Ph className="h-8 w-16" />
        </div>
      ))}
    </PreviewCard>
  );
}

export default function ApiKeysSettingsPage() {
  return (
    <ComingSoon
      href="/settings/api-keys"
      bullets={[
        "Programmatic access to ask, ingest and search",
        "Scoped keys per environment with instant revocation",
        "Usage visible per key in Analytics",
      ]}
      preview={<ApiKeysPreview />}
    />
  );
}
