"use client";

import { ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Hint, Input, Label } from "@/components/ui/Field";
import { useMounted } from "@/hooks/useMounted";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

export default function AccountPage() {
  const mounted = useMounted();
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.role);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Editing goes live with real accounts in the backend phases.
        </CardDescription>
        <div className="mt-6 flex items-center gap-4">
          <Avatar name={user.name} />
          <div>
            <p className="text-sm font-semibold text-primary">{user.name}</p>
            <p className="text-xs text-subtle">{user.email}</p>
          </div>
          <Badge variant="accent" className="ml-auto capitalize">
            <ShieldCheck className="h-3 w-3" />
            {mounted ? role : "admin"}
          </Badge>
        </div>
        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            toast(
              "Profile saved (demo)",
              "Real accounts arrive with Backend Phase 0.",
              "success",
            );
          }}
        >
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" defaultValue={user.name} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={user.email} />
            <Hint>Sign-in email — used for invites and notifications.</Hint>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Your role in this workspace</CardTitle>
        <CardDescription>
          Roles decide what the assistant can even do for you: employees ask,
          managers act, admins configure. Try it now — switch your demo role
          from the avatar menu and watch the sidebar change.
        </CardDescription>
      </Card>
    </div>
  );
}
