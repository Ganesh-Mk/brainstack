import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { Toaster } from "@/components/ui/Toaster";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bs-dotgrid relative flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-between px-6 py-5">
        <BrandMark />
        <Link
          href="/"
          className="text-sm font-medium text-muted transition hover:text-primary"
        >
          ← Back to brainstack.space
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="bs-scale-in w-full max-w-md">{children}</div>
      </main>
      <footer className="pb-6 text-center text-xs text-subtle">
        © {new Date().getFullYear()} BrainStack · Your company&apos;s second
        brain, fully stacked
      </footer>
      <Toaster />
    </div>
  );
}
