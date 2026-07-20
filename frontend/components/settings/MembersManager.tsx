"use client";

import { useEffect, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import {
  api,
  ApiError,
  type ApiMember,
  isBackendConfigured,
} from "@/lib/api";
import type { Role } from "@/lib/nav";
import { timeAgo } from "@/lib/time";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

const DEMO_MEMBERS: ApiMember[] = [
  { id: "u1", name: "Demo User", email: "you@lovelydesign.in", role: "admin", created_at: new Date(Date.now() - 90 * 86400e3).toISOString() },
  { id: "u2", name: "Priya N", email: "priya@lovelydesign.in", role: "manager", created_at: new Date(Date.now() - 60 * 86400e3).toISOString() },
  { id: "u3", name: "Dev K", email: "dev@lovelydesign.in", role: "employee", created_at: new Date(Date.now() - 30 * 86400e3).toISOString() },
];

const ROLE_OPTIONS: Role[] = ["employee", "manager", "admin"];

/** The live member list + invite + role management — shared by the Team
 * page and Settings → Members. Admin-only data; parents gate rendering. */
export function MembersManager() {
  const demo = !isBackendConfigured;
  const token = useSessionStore((s) => s.token);
  const me = useSessionStore((s) => s.user);
  const [members, setMembers] = useState<ApiMember[] | null>(
    demo ? DEMO_MEMBERS : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("employee");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (demo || !token) return;
    const t = setTimeout(async () => {
      try {
        setMembers(await api.listMembers(token));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load members.");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [demo, token]);

  const changeRole = async (m: ApiMember, role: Role) => {
    if (demo || !token) {
      toast("Demo mode", "Role changes work once your workspace is live.");
      return;
    }
    try {
      const updated = await api.updateMemberRole(token, m.id, role);
      setMembers((prev) =>
        (prev ?? []).map((x) => (x.id === m.id ? updated : x)),
      );
      toast("Role updated", `${m.name} is now ${role}.`);
    } catch (e) {
      toast("Couldn't update", e instanceof ApiError ? e.message : "Try again.", "error");
    }
  };

  const remove = async (m: ApiMember) => {
    if (demo || !token) {
      toast("Demo mode", "Removing works once your workspace is live.");
      return;
    }
    try {
      await api.removeMember(token, m.id);
      setMembers((prev) => (prev ?? []).filter((x) => x.id !== m.id));
      toast("Removed", `${m.name} no longer has access.`);
    } catch (e) {
      toast("Couldn't remove", e instanceof ApiError ? e.message : "Try again.", "error");
    }
  };

  const sendInvite = async () => {
    if (demo || !token) {
      toast("Demo mode", "Invites work once your workspace is live.");
      return;
    }
    setBusy(true);
    try {
      const inv = await api.createInvite(token, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteLink(`${window.location.origin}/invite?token=${inv.token}`);
    } catch (e) {
      toast("Invite failed", e instanceof ApiError ? e.message : "Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Members
          </p>
          <Button
            size="sm"
            onClick={() => {
              setInviteOpen(true);
              setInviteLink(null);
              setInviteEmail("");
            }}
          >
            <UserPlus className="h-3.5 w-3.5" /> Invite
          </Button>
        </div>

        {members === null && !error ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-muted">{error}</p>
        ) : (
          <ul>
            {(members ?? []).map((m) => {
              const isMe = !demo && m.id === me.id;
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3.5 border-b border-border px-5 py-3 last:border-0"
                >
                  <Avatar name={m.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">
                      {m.name}
                      {isMe && (
                        <Badge variant="neutral" className="ml-2">
                          you
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-subtle">
                      {m.email} · joined {timeAgo(m.created_at)}
                    </p>
                  </div>
                  {isMe ? (
                    <Badge variant="accent">{m.role}</Badge>
                  ) : (
                    <>
                      <Select
                        value={m.role}
                        onChange={(e) => void changeRole(m, e.target.value as Role)}
                        className="w-32"
                        aria-label={`Role for ${m.name}`}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void remove(m)}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a teammate"
      >
        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Send them this link — it signs them into{" "}
              <span className="font-medium text-primary">{inviteEmail}</span> as{" "}
              <span className="font-medium text-primary">{inviteRole}</span> and
              expires in 7 days.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteLink} className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              onClick={() => void sendInvite()}
              disabled={busy || !inviteEmail.includes("@")}
              className="w-full"
            >
              Create invite link
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
