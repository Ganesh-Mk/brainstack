"use client";

import { Library } from "lucide-react";
import { isBackendConfigured, isProcessing } from "@/lib/api";
import { KpiTile } from "@/components/ui/KpiTile";
import { useDocuments } from "@/hooks/useDocuments";

/**
 * The dashboard's first REAL number: documents indexed in this workspace.
 * Falls back to the sample figure in demo mode, keeping the dashboard's
 * sample-data story coherent until each metric goes live.
 */
export function DocsIndexedTile() {
  const { docs } = useDocuments();

  if (!isBackendConfigured) {
    return (
      <KpiTile
        label="Documents indexed"
        value="87"
        delta="+6 this week"
        deltaTone="up"
        icon={Library}
      />
    );
  }

  const ready = docs?.filter((d) => d.status === "ready").length;
  const processing = docs?.filter((d) => isProcessing(d.status)).length ?? 0;

  return (
    <KpiTile
      label="Documents indexed"
      value={ready === undefined ? "—" : String(ready)}
      delta={processing > 0 ? `${processing} processing` : "live"}
      deltaTone={processing > 0 ? "up" : "neutral"}
      icon={Library}
    />
  );
}
