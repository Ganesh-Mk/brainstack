import type { Metadata } from "next";
import { AddSourcesView } from "./view";

export const metadata: Metadata = { title: "Add Sources" };

export default function AddSourcesPage() {
  return <AddSourcesView />;
}
