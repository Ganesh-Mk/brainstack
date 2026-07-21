import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Cable, Rocket, Upload } from "lucide-react";
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
    icon: BookOpen,
    title: "API reference",
    text: "Ask, ingest and search programmatically — scopes, limits, errors.",
    href: "/docs/api",
  },
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
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20">
      <div className="text-center">
        <TextReveal
          text="Documentation"
          className="text-4xl font-semibold tracking-tight text-primary"
        />
        <Reveal delay={0.2}>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
            Guides and references land alongside the features they document. The
            API reference is live; the rest are on their way.
          </p>
        </Reveal>
      </div>
      <Stagger className="mt-12 grid gap-5 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const body = (
            <Card className="h-full p-5" interactive={Boolean(s.href)}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <s.icon className="h-4.5 w-4.5" />
              </span>
              <h2 className="mt-4 flex items-center gap-2 text-base font-semibold text-primary">
                {s.title}
                {!s.href && <Badge variant="lock">Coming Soon</Badge>}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">{s.text}</p>
              {s.href && (
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Read it <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </Card>
          );
          return (
            <StaggerItem key={s.title}>
              {s.href ? <Link href={s.href}>{body}</Link> : body}
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
