"use client";

import { useState } from "react";
import { Mail, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Field";
import { toast } from "@/stores/toast";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Tell us your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return setError("Enter a valid email so we can reply.");
    if (message.trim().length < 10)
      return setError("Give us a sentence or two about what you need.");
    setError("");
    setName("");
    setEmail("");
    setMessage("");
    toast(
      "Message noted (demo)",
      "The contact form goes live with the backend — for now, we appreciate the enthusiasm!",
      "success",
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">
            Contact
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-primary">
            Talk to us
          </h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Want a walkthrough, a security deep-dive, or to talk about
            connecting your company&apos;s systems? We read everything.
          </p>
          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <MessageSquare className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">
                  Book a demo
                </p>
                <p className="text-sm text-muted">
                  A 20-minute tour of the workspace, trace panel and actions.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Mail className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">Email</p>
                <p className="text-sm text-muted">hello@brainstack.space</p>
              </div>
            </div>
          </div>
        </div>

        <Card className="p-8">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Rivera"
              />
            </div>
            <div>
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <Label htmlFor="message">What do you need?</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="We're evaluating AI knowledge tools for a 200-person team…"
              />
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" variant="accent" className="w-full">
              <Send className="h-4 w-4" />
              Send message
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
