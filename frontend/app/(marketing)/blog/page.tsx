import type { Metadata } from "next";
import { BookOpen, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  Reveal,
  Stagger,
  StaggerItem,
  TextReveal,
} from "@/components/marketing/motion";
import { Ph } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "Blog" };

const UPCOMING = [
  "Why every answer needs a citation (and how we build them)",
  "MCP explained: USB for AI tools",
  "Tenant isolation for AI: the leak you'd never notice",
];

export default function BlogPage() {
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
          text="The BrainStack blog"
          accent={["brainstack"]}
          className="mt-4 text-4xl font-semibold tracking-tight text-primary"
        />
        <Reveal delay={0.2}>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
            Engineering notes from building a grounded, multi-tenant AI platform
            — retrieval, agents, MCP, evaluation, and the honest trade-offs.
          </p>
        </Reveal>
      </div>
      <Stagger className="mt-12 grid gap-5 sm:grid-cols-3">
        {UPCOMING.map((title) => (
          <StaggerItem key={title}>
            <Card className="h-full p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <BookOpen className="h-4 w-4" />
              </span>
              <p className="mt-3.5 text-sm font-semibold text-primary">
                {title}
              </p>
              <div className="mt-3 space-y-2">
                <Ph className="h-2.5 w-full" />
                <Ph className="h-2.5 w-4/5" />
              </div>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
