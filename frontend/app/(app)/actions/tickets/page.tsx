import type { Metadata } from "next";
import { TicketsView } from "./view";

export const metadata: Metadata = { title: "Tickets" };

export default function TicketsPage() {
  return <TicketsView />;
}
