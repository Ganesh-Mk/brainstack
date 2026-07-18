import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="bs-dotgrid flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <div className="bs-scale-in">
        <BrandMark href="/" className="justify-center" />
        <p className="mt-10 text-7xl font-semibold tracking-tight text-primary">
          404
        </p>
        <h1 className="mt-3 text-xl font-semibold text-primary">
          This page isn&apos;t in the knowledge base
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
          Even a second brain draws a blank sometimes. Let&apos;s get you back
          to something real.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/" className={buttonClasses("accent")}>
            Go home
          </Link>
          <Link href="/dashboard" className={buttonClasses("outline")}>
            Open the app
          </Link>
        </div>
      </div>
    </div>
  );
}
