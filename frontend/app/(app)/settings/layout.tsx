import { Settings } from "lucide-react";
import { SettingsTabs } from "@/components/layout/SettingsTabs";
import { PageHeader } from "@/components/patterns/PageHeader";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bs-fade-up w-full max-w-4xl">
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Configure your workspace — members, connected systems, models, appearance and programmatic access."
      />
      <div className="mt-6 border-b border-border pb-3">
        <SettingsTabs />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
