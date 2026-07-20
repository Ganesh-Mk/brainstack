"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CircleCheck,
  Rocket,
  Upload,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Hint, Input, Label, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { toast } from "@/stores/toast";

const STEPS = [
  { icon: Building2, label: "Workspace" },
  { icon: UserPlus, label: "Invite team" },
  { icon: Upload, label: "First source" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState("Lovely");
  const [invites, setInvites] = useState("");

  const finish = () => {
    toast(
      "Workspace ready (demo)",
      "Add real sources once the ingestion backend lands.",
      "success",
    );
    router.push("/dashboard");
  };

  return (
    <Card className="p-8">
      {/* Stepper */}
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s.label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition",
                i < step &&
                  "border-success/40 bg-success/10 text-success",
                i === step && "border-accent bg-accent text-on-accent",
                i > step && "border-border bg-surface-raised text-subtle",
              )}
            >
              {i < step ? <CircleCheck className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-xs font-medium sm:block",
                i === step ? "text-primary" : "text-subtle",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="h-px flex-1 bg-border" />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-7 min-h-48">
        {step === 0 && (
          <div className="bs-fade-in space-y-4">
            <div>
              <h1 className="text-lg font-semibold text-primary">
                Name your workspace
              </h1>
              <p className="mt-1 text-sm text-muted">
                Usually your company name — teammates will see it.
              </p>
            </div>
            <div>
              <Label htmlFor="workspace">Workspace name</Label>
              <Input
                id="workspace"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
              />
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="bs-fade-in space-y-4">
            <div>
              <h1 className="text-lg font-semibold text-primary">
                Invite your team
              </h1>
              <p className="mt-1 text-sm text-muted">
                They&apos;ll join as employees — promote managers and admins
                later in Team &amp; Roles.
              </p>
            </div>
            <div>
              <Label htmlFor="invites">Email addresses</Label>
              <Textarea
                id="invites"
                placeholder={"priya@company.com\ndev@company.com"}
                value={invites}
                onChange={(e) => setInvites(e.target.value)}
              />
              <Hint>One per line. You can skip this and invite later.</Hint>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="bs-fade-in space-y-4">
            <div>
              <h1 className="text-lg font-semibold text-primary">
                Add your first source
              </h1>
              <p className="mt-1 text-sm text-muted">
                This is where the second brain starts — and it unlocks with the
                ingestion backend very soon.
              </p>
            </div>
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-border-strong bg-canvas px-6 py-8 text-center">
              <Upload className="h-6 w-6 text-subtle" />
              <p className="mt-2.5 text-sm font-medium text-primary">
                Document upload is almost here
              </p>
              <p className="mt-1 text-xs leading-5 text-subtle">
                Finish setup now — we&apos;ll nudge you the moment uploads go
                live.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-7 flex items-center justify-between border-t border-border pt-5">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="accent" onClick={() => setStep((s) => s + 1)}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="accent" onClick={finish}>
            <Rocket className="h-4 w-4" />
            Enter your workspace
          </Button>
        )}
      </div>
    </Card>
  );
}
