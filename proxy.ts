import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Better Auth API routes — always pass through.
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Read the session cookie set by Better Auth. This does NOT make a DB call —
  // it just checks whether the cookie exists and is structurally valid. Role
  // checks (clinic vs patient) happen in the layouts, which have DB access.
  const session = getSessionCookie(request);

  // /panel/** — redirect to /login if not authenticated.
  if (pathname.startsWith("/panel")) {
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // /patient/** — redirect to /patient/login if not authenticated.
  if (pathname.startsWith("/patient")) {
    // Allow /patient/login itself through unconditionally.
    if (pathname === "/patient/login") {
      return NextResponse.next();
    }
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/patient/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
