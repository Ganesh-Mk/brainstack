import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

/**
 * The consistent "this is coming" marker.
 * `compact` → a bare lock glyph (sidebar rows, palette).
 * default   → the full "Coming Soon" pill (page headers, cards).
 */
export function LockBadge({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <Lock
        aria-label="Coming soon"
        className={cn("h-3 w-3 shrink-0 text-subtle", className)}
      />
    );
  }
  return (
    <Badge variant="lock" className={className}>
      <Lock className="h-3 w-3" />
      Coming Soon
    </Badge>
  );
}
