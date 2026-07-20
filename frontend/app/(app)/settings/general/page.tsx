import type { Metadata } from "next";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { Ph, PreviewCard } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "General settings" };

function GeneralPreview() {
  return (
    <PreviewCard className="space-y-4">
      <div>
        <p className="text-xs font-medium text-primary">Workspace name</p>
        <div className="mt-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-primary">
          Lovely
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-primary">Workspace logo</p>
        <div className="mt-1.5 flex items-center gap-3">
          <Ph className="h-12 w-12 rounded-xl" />
          <Ph className="h-8 w-24" />
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-primary">Default answer language</p>
        <Ph className="mt-1.5 h-9 w-48" />
      </div>
    </PreviewCard>
  );
}

export default function GeneralSettingsPage() {
  return (
    <ComingSoon
      href="/settings/general"
      bullets={[
        "Workspace name and logo",
        "Default language and answer style",
        "Data-retention preferences",
      ]}
      preview={<GeneralPreview />}
    />
  );
}
