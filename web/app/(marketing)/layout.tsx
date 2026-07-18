import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { MarketingNav } from "@/components/layout/MarketingNav";
import { Toaster } from "@/components/ui/Toaster";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <Toaster />
    </div>
  );
}
