import type { Metadata } from "next";
import { IngestionView } from "./view";

export const metadata: Metadata = { title: "Ingestion" };

export default function IngestionPage() {
  return <IngestionView />;
}
