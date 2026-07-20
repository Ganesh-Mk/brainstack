"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { api, ApiError, isBackendConfigured } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Hint, Input, Label } from "@/components/ui/Field";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

export default function SignupPage() {
  const router = useRouter();
  const loginWith = useSessionStore((s) => s.loginWith);
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company.trim().length < 2) {
      setError("Give your company workspace a name.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Tell us your name.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid work email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");

    if (!isBackendConfigured) {
      toast(
        `Workspace "${company}" created (demo)`,
        "Let's set it up — real accounts arrive with the backend.",
        "success",
      );
      router.push("/onboarding");
      return;
    }

    setBusy(true);
    try {
      const result = await api.signup({
        company_name: company.trim(),
        name: name.trim(),
        email,
        password,
      });
      loginWith(result);
      toast(
        `Workspace "${result.tenant.name}" created`,
        "You're the admin — let's set it up.",
        "success",
      );
      router.push("/onboarding");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-8">
      <h1 className="text-xl font-semibold tracking-tight text-primary">
        Create your workspace
      </h1>
      <p className="mt-1 text-sm text-muted">
        One workspace per company — your data stays fully isolated.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="company">Company name</Label>
          <Input
            id="company"
            placeholder="Acme Corp"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <Hint>This becomes your workspace — you&apos;ll be its admin.</Hint>
        </div>
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Jordan Rivera"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
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
          <Rocket className="h-4 w-4" />
          {busy ? "Creating…" : "Create workspace"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have one?{" "}
        <Link
          href="/login"
          className="font-medium text-accent transition hover:text-accent-hover"
        >
          Sign in
        </Link>
      </p>
    </Card>
  );
}
