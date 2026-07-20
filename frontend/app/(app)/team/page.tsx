import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { PreviewCard } from "@/components/patterns/preview";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Team & Roles" };

const MEMBERS = [
  { name: "You (Demo User)", email: "you@lovelydesign.in", role: "Admin" },
  { name: "Priya N", email: "priya@lovelydesign.in", role: "Manager" },
  { name: "Dev K", email: "dev@lovelydesign.in", role: "Employee" },
  { name: "Sara M", email: "sara@lovelydesign.in", role: "Employee" },
];

function TeamPreview() {
  return (
    <PreviewCard className="p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
          Members · Lovely
        </p>
        <span className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-on-primary">
          <UserPlus className="h-3.5 w-3.5" /> Invite
        </span>
      </div>
      <ul>
        {MEMBERS.map((member) => (
          <li
            key={member.email}
            className="flex items-center gap-3.5 border-b border-border px-5 py-3 last:border-0"
          >
            <Avatar name={member.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary">
                {member.name}
              </p>
              <p className="truncate text-xs text-subtle">{member.email}</p>
            </div>
            <Badge
              variant={
                member.role === "Admin"
                  ? "accent"
                  : member.role === "Manager"
                    ? "success"
                    : "neutral"
              }
            >
              {member.role}
            </Badge>
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}

export default function TeamPage() {
  return (
    <ComingSoon
      href="/team"
      bullets={[
        "Invite teammates by email, assign roles on the way in",
        "Three roles: admin (configure), manager (act), employee (ask)",
        "A member's role decides which agent capabilities even exist for them",
        "Deactivate someone and their access ends everywhere at once",
      ]}
      preview={<TeamPreview />}
    />
  );
}
