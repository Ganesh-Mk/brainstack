"use client";

import { useRouter } from "next/navigation";
import { Building2, ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toast } from "@/stores/toast";

export default function InvitePage() {
  const router = useRouter();

  return (
    <Card className="p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <UserPlus className="h-5.5 w-5.5" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-primary">
        You&apos;re invited
      </h1>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        <span className="font-medium text-primary">Priya N</span> invited you to
        join the{" "}
        <span className="font-medium text-primary">Acme Corp</span> workspace on
        BrainStack.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Badge variant="neutral">
          <Building2 className="h-3 w-3" />
          Acme Corp
        </Badge>
        <Badge variant="accent">
          <ShieldCheck className="h-3 w-3" />
          Role: Employee
        </Badge>
      </div>
      <Button
        variant="accent"
        className="mt-6 w-full"
        onClick={() => {
          toast(
            "Invite accepted (demo)",
            "Real invites arrive with the backend.",
            "success",
          );
          router.push("/dashboard");
        }}
      >
        Accept invitation
      </Button>
      <p className="mt-4 text-xs leading-5 text-subtle">
        Your role decides what the assistant can do for you — employees ask,
        managers act, admins configure.
      </p>
    </Card>
  );
}
