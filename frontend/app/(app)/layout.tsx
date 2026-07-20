import type { Metadata } from "next";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { SessionGate } from "@/components/layout/SessionGate";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Toaster } from "@/components/ui/Toaster";

export const metadata: Metadata = {
  robots: { index: false, follow: false }, // the app surface is not for crawlers
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionGate>
      <div className="flex h-dvh bg-canvas">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
        <CommandPalette />
        <Toaster />
      </div>
    </SessionGate>
  );
}
