import { redirect } from "next/navigation";

// Ingestion merged into Add Sources — one page to add a source AND watch it
// move through the pipeline. Old links keep working.
export default function IngestionPage() {
  redirect("/knowledge/add");
}
