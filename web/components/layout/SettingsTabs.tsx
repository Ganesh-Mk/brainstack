"use client";

import { usePathname } from "next/navigation";
import { PillTabs } from "@/components/ui/Tabs";
import { SETTINGS_TABS } from "@/lib/nav";

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <PillTabs
      tabs={SETTINGS_TABS.map((tab) => ({
        label: tab.label,
        href: tab.href,
        icon: tab.icon,
        locked: tab.locked,
      }))}
      activeHref={
        SETTINGS_TABS.find((tab) => pathname.startsWith(tab.href))?.href ??
        "/settings/general"
      }
    />
  );
}
