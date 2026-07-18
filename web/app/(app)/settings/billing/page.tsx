import type { Metadata } from "next";
import { ComingSoon } from "@/components/patterns/ComingSoon";
import { Ph, PreviewCard } from "@/components/patterns/preview";

export const metadata: Metadata = { title: "Billing" };

function BillingPreview() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {["Starter", "Team", "Enterprise"].map((plan, i) => (
        <PreviewCard key={plan} className={i === 1 ? "border-accent" : ""}>
          <p className="text-sm font-semibold text-primary">{plan}</p>
          <Ph className="mt-2 h-7 w-20" />
          <div className="mt-3 space-y-2">
            <Ph className="h-2.5 w-full" />
            <Ph className="h-2.5 w-4/5" />
            <Ph className="h-2.5 w-3/5" />
          </div>
          <Ph
            className={`mt-4 h-9 w-full ${i === 1 ? "bg-primary/80" : ""}`}
          />
        </PreviewCard>
      ))}
    </div>
  );
}

export default function BillingSettingsPage() {
  return (
    <ComingSoon
      href="/settings/billing"
      bullets={[
        "Plan management and usage-based billing",
        "Per-month spend with alerts before you hit limits",
        "Invoices and receipts, self-serve",
      ]}
      preview={<BillingPreview />}
    />
  );
}
