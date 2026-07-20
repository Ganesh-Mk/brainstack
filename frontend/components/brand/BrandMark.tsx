import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The BrainStack mark: stacked knowledge layers with a "spark" node.
 * The tile inherits the accent token, so rebranding recolors the logo too.
 */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("h-8 w-8 text-accent", className)}
    >
      <rect width="64" height="64" rx="14" fill="currentColor" />
      <rect x="14" y="15" width="36" height="9" rx="4.5" fill="#fff" opacity="0.95" />
      <rect x="14" y="27.5" width="24" height="9" rx="4.5" fill="#fff" opacity="0.78" />
      <circle cx="45.5" cy="32" r="4.5" fill="#fff" />
      <rect x="14" y="40" width="36" height="9" rx="4.5" fill="#fff" opacity="0.6" />
    </svg>
  );
}

export function BrandMark({
  href = "/",
  className,
  glyphClassName,
  wordmark = true,
}: {
  href?: string;
  className?: string;
  glyphClassName?: string;
  wordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 text-primary transition hover:opacity-80",
        className,
      )}
    >
      <BrandGlyph className={glyphClassName} />
      {wordmark && (
        <span className="text-lg font-semibold tracking-tight">
          Brain<span className="text-accent">Stack</span>
        </span>
      )}
    </Link>
  );
}
