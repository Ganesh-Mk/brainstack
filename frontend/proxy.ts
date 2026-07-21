import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Host-based routing for the one-app / two-subdomain setup:
 *
 *   brainstack.space       → the marketing site   (app/(marketing))
 *   app.brainstack.space   → the platform + auth  (app/(app), app/(auth))
 *
 * Route groups share one URL space with no path collisions, so all this
 * proxy does is keep each *class* of path on its proper host:
 *   - marketing paths requested on the app host  → redirect to the apex
 *   - app/auth paths requested on the apex       → redirect to the app host
 *   - `/` on the app host                        → /dashboard
 *   - www                                        → apex
 *
 * On localhost and *.vercel.app previews it does nothing, so every route is
 * reachable from one origin during development and review.
 */

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "brainstack.space";
const APP_DOMAIN =
  process.env.NEXT_PUBLIC_APP_DOMAIN ?? "app.brainstack.space";

const MARKETING_PREFIXES = [
  "/features",
  "/security",
  "/about",
  "/contact",
  "/docs",
  "/legal",
];

function isMarketingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return MARKETING_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];

  // Dev servers and Vercel preview URLs: single origin, no host games.
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".vercel.app")
  ) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  // www → apex
  if (hostname === `www.${ROOT_DOMAIN}`) {
    return NextResponse.redirect(
      `https://${ROOT_DOMAIN}${pathname}${search}`,
      308,
    );
  }

  if (hostname === APP_DOMAIN) {
    if (pathname === "/") {
      return NextResponse.redirect(`https://${APP_DOMAIN}/dashboard`, 307);
    }
    if (isMarketingPath(pathname)) {
      return NextResponse.redirect(
        `https://${ROOT_DOMAIN}${pathname}${search}`,
        307,
      );
    }
    return NextResponse.next();
  }

  if (hostname === ROOT_DOMAIN) {
    if (!isMarketingPath(pathname)) {
      return NextResponse.redirect(
        `https://${APP_DOMAIN}${pathname}${search}`,
        307,
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals, API routes and any file with an extension.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
