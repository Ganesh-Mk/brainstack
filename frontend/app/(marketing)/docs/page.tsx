import type { Metadata } from "next";
import { BookOpen, Cable, Lock, Rocket, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  Reveal,
  Stagger,
  StaggerItem,
  TextReveal,
} from "@/components/marketing/motion";

export const metadata: Metadata = { title: "Docs" };

const SECTIONS = [
  {
    icon: Rocket,
    title: "Getting started",
    text: "Create a workspace, invite the team, add your first sources.",
  },
  {
    icon: Upload,
    title: "Knowledge & ingestion",
    text: "Supported formats, chunking behavior, and metadata.",
  },
  {
    icon: Cable,
    title: "Connecting your systems (MCP)",
    text: "Stand up a Company MCP Server and gate it by role.",
  },
  {
    icon: BookOpen,
    title: "API reference",
    text: "Ask, ingest and search programmatically.",
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20">
      <div className="text-center">
        <Reveal>
          <Badge variant="lock" className="mx-auto">
            <Lock className="h-3 w-3" />
            Coming Soon
          </Badge>
        </Reveal>
        <TextReveal
          text="Documentation"
          className="mt-4 text-4xl font-semibold tracking-tight text-primary"
        />
        <Reveal delay={0.2}>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
            Guides and references land alongside the features they document.
            Here&apos;s the shape of what&apos;s coming.
          </p>
        </Reveal>
      </div>
      <Stagger className="mt-12 grid gap-5 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <StaggerItem key={s.title}>
            <Card className="h-full p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <s.icon className="h-4.5 w-4.5" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-primary">
                {s.title}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">{s.text}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
