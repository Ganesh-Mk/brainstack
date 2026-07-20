import type { Metadata } from "next";
import { AgentTraceView } from "./view";

export const metadata: Metadata = { title: "Agent Trace" };

export default function AgentTracePage() {
  return <AgentTraceView />;
}
