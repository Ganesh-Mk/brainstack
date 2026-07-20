import type { Metadata } from "next";
import { AskView } from "./view";

export const metadata: Metadata = { title: "Ask BrainStack" };

export default function AskPage() {
  return <AskView />;
}
