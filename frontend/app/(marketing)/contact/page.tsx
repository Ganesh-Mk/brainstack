"use client";

import { useState } from "react";
import { Mail, MessageSquare, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Field";
import { Reveal } from "@/components/marketing/motion";
import { toast } from "@/stores/toast";

/** Form-to-email relay — delivers straight to the founder's inbox without a
 * mail server of our own. The AJAX endpoint returns JSON and allows CORS. */
const CONTACT_ENDPOINT = "https://formsubmit.co/ajax/ganeshmk247@gmail.com";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Tell us your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return setError("Enter a valid email so we can reply.");
    if (message.trim().length < 10)
      return setError("Give us a sentence or two about what you need.");
    setError("");
    setSending(true);
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          _subject: `BrainStack contact — ${name.trim()}`,
          _template: "table",
          _captcha: "false",
        }),
      });
      if (!res.ok) throw new Error(`relay returned ${res.status}`);
      setName("");
      setEmail("");
      setMessage("");
      toast(
        "Message sent",
        "It's on its way to Ganesh's inbox — you'll hear back at the email you gave.",
        "success",
      );
    } catch {
      setError(
        "Couldn't send right now — email ganeshmk247@gmail.com directly instead.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <Reveal>
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
          </Reveal>

          <Reveal delay={0.1} className="mt-8 space-y-4">
            {/* Founder */}
            <Card className="flex items-start gap-3.5 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-semibold text-on-primary">
                G
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <UserRound className="h-3.5 w-3.5 text-accent" />
                  Ganesh Koparde
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted">
                  Founder — built BrainStack end-to-end, from the retrieval
                  pipeline to the pixels on this page.
                </p>
                <a
                  href="mailto:ganeshmk247@gmail.com"
                  className="mt-1.5 inline-block text-xs font-medium text-accent hover:underline"
                >
                  ganeshmk247@gmail.com
                </a>
              </div>
            </Card>

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
                <a
                  href="mailto:ganeshmk247@gmail.com"
                  className="text-sm text-muted hover:text-primary"
                >
                  ganeshmk247@gmail.com
                </a>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15} y={28}>
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
              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={sending}
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending…" : "Send message"}
              </Button>
            </form>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
