"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { toast } from "@/stores/toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid work email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    toast(
      "Welcome to the demo workspace",
      "Real sign-in arrives with the backend — explore freely.",
      "success",
    );
    router.push("/dashboard");
  };

  return (
    <Card className="p-8">
      <h1 className="text-xl font-semibold tracking-tight text-primary">
        Welcome back
      </h1>
      <p className="mt-1 text-sm text-muted">
        Sign in to your company workspace.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
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
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot"
              className="text-xs font-medium text-accent transition hover:text-accent-hover"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="accent" className="w-full">
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-accent transition hover:text-accent-hover"
        >
          Create your company workspace
        </Link>
      </p>
      <p className="mt-4 rounded-lg bg-surface-raised px-3 py-2 text-center text-xs text-subtle">
        Demo mode — any valid-looking input signs you into the sample
        workspace.
      </p>
    </Card>
  );
}
