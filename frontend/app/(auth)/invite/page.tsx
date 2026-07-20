"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, ShieldCheck, UserPlus } from "lucide-react";
import {
  api,
  ApiError,
  type InviteInfo,
  isBackendConfigured,
} from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

/** Static demo card — shown when there's no backend or no invite token. */
function DemoInvite() {
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
        join the <span className="font-medium text-primary">Acme Corp</span>{" "}
        workspace on BrainStack.
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

/** Real invite acceptance — validates the token, collects name + password. */
function RealInvite({ token }: { token: string }) {
  const router = useRouter();
  const loginWith = useSessionStore((s) => s.loginWith);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .inviteInfo(token)
      .then(setInfo)
      .catch((err) =>
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "This invite link is invalid.",
        ),
      );
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Tell us your name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await api.acceptInvite(token, {
        name: name.trim(),
        password,
      });
      loginWith(result);
      toast(`Welcome to ${result.tenant.name}`, undefined, "success");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          Invite unavailable
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">{loadError}</p>
        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={() => router.push("/login")}
        >
          Go to sign in
        </Button>
      </Card>
    );
  }

  if (!info) {
    return (
      <Card className="p-8 text-center text-sm text-muted">
        Checking your invitation…
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <UserPlus className="h-5.5 w-5.5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-primary">
          You&apos;re invited
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          Join the{" "}
          <span className="font-medium text-primary">{info.company_name}</span>{" "}
          workspace on BrainStack.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Badge variant="neutral">
            <Building2 className="h-3 w-3" />
            {info.company_name}
          </Badge>
          <Badge variant="accent">
            <ShieldCheck className="h-3 w-3" />
            Role: {ROLE_LABEL[info.role] ?? info.role}
          </Badge>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" value={info.email} disabled />
        </div>
        <div>
          <Label htmlFor="invite-name">Your name</Label>
          <Input
            id="invite-name"
            autoComplete="name"
            placeholder="Jordan Rivera"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="invite-password">Create a password</Label>
          <Input
            id="invite-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button
          type="submit"
          variant="accent"
          className="w-full"
          disabled={busy}
        >
          {busy ? "Joining…" : "Accept & join"}
        </Button>
      </form>
    </Card>
  );
}

function InviteInner() {
  const token = useSearchParams().get("token");
  if (isBackendConfigured && token) return <RealInvite token={token} />;
  return <DemoInvite />;
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteInner />
    </Suspense>
  );
}
