import type { Metadata } from "next";
import { WorkforceView } from "./view";

export const metadata: Metadata = { title: "Workforce Analytics" };

export default function WorkforceAnalyticsPage() {
  return <WorkforceView />;
}
