import type { Metadata } from "next";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { Ph, PreviewCard } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "Members" };

function MembersPreview() {
  return (
    <PreviewCard className="space-y-3">
      <div className="flex items-center justify-between">
        <Ph className="h-9 w-64" />
        <Ph className="h-9 w-24 bg-primary/80" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Ph className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Ph className="h-3 w-32" />
            <Ph className="h-2.5 w-44" />
          </div>
          <Ph className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </PreviewCard>
  );
}

export default function MembersSettingsPage() {
  return (
    <ComingSoon
      href="/settings/members"
      bullets={[
        "Invite by email with a role attached",
        "Change roles inline — takes effect on the next session",
        "Pending invites with resend and revoke",
      ]}
      preview={<MembersPreview />}
    />
  );
}
