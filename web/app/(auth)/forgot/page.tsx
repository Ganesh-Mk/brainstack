"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { toast } from "@/stores/toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter the email you signed up with.");
      return;
    }
    setError("");
    setSent(true);
    toast(
      "Reset link sent (demo)",
      "Real password resets arrive with the backend.",
      "success",
    );
  };

  return (
    <Card className="p-8">
      <h1 className="text-xl font-semibold tracking-tight text-primary">
        Reset your password
      </h1>
      <p className="mt-1 text-sm text-muted">
        We&apos;ll email you a link to set a new one.
      </p>
      {sent ? (
        <div className="mt-6 rounded-xl border border-success/25 bg-success/10 p-4 text-sm leading-6 text-primary">
          If <span className="font-medium">{email}</span> has a workspace, a
          reset link is on its way. Check your inbox.
        </div>
      ) : (
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
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" variant="accent" className="w-full">
            <Mail className="h-4 w-4" />
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-accent transition hover:text-accent-hover"
        >
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
