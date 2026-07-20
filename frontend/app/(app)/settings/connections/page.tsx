import type { Metadata } from "next";
import { ConnectionsView } from "@/app/(app)/connections/view";

export const metadata: Metadata = { title: "Connection settings" };

// The Connections page IS the settings surface for the Company MCP Server —
// its URL and secret are environment-managed, so this tab shows the live
// connection state rather than duplicating an editor that can't exist.
export default function ConnectionSettingsPage() {
  return <ConnectionsView />;
}
