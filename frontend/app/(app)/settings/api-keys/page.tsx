import type { Metadata } from "next";
import { ApiKeysSettingsView } from "./view";

export const metadata: Metadata = { title: "API keys" };

export default function ApiKeysSettingsPage() {
  return <ApiKeysSettingsView />;
}
