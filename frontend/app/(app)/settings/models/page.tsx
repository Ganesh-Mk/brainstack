import type { Metadata } from "next";
import { ModelsSettingsView } from "./view";

export const metadata: Metadata = { title: "Models & cost" };

export default function ModelsSettingsPage() {
  return <ModelsSettingsView />;
}
