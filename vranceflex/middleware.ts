import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE } from "./lib/auth/config";

const protectedPages = [
  "/dashboard",
  "/campaigns",
  "/leads",
  "/icp",
  "/settings",
];

export default function middleware(request: NextRequest) {
  const isProtected = protectedPages.some(
    (path) =>
      request.nextUrl.pathname === path ||
      request.nextUrl.pathname.startsWith(`${path}/`),
  );

  if (isProtected && !request.cookies.has(AUTH_SESSION_COOKIE)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
