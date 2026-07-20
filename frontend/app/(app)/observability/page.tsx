import type { Metadata } from "next";
import { ObservabilityView } from "./view";

export const metadata: Metadata = { title: "Observability" };

export default function ObservabilityPage() {
  return <ObservabilityView />;
}
