import type { Metadata } from "next";
import { MembersSettingsView } from "./view";

export const metadata: Metadata = { title: "Members" };

export default function MembersSettingsPage() {
  return <MembersSettingsView />;
}
