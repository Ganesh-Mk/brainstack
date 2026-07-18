import { Settings } from "lucide-react";
import { SettingsTabs } from "@/components/layout/SettingsTabs";
import { PageHeader } from "@/components/patterns/PageHeader";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bs-fade-up mx-auto w-full max-w-4xl">
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Configure your workspace. Appearance is live today — the rest switches on with the backend."
      />
      <div className="mt-6 border-b border-border pb-3">
        <SettingsTabs />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
