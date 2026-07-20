import type { Metadata } from "next";
import { GeneralSettingsView } from "./view";

export const metadata: Metadata = { title: "General settings" };

export default function GeneralSettingsPage() {
  return <GeneralSettingsView />;
}
