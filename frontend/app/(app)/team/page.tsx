import type { Metadata } from "next";
import { TeamView } from "./view";

export const metadata: Metadata = { title: "Team & Roles" };

export default function TeamPage() {
  return <TeamView />;
}
