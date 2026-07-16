import { auth } from "~/server/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isLoginRoute = req.nextUrl.pathname === "/admin/login";

  // If accessing /admin/* (but not login) and not authenticated → redirect to login
  if (isAdminRoute && !isLoginRoute && !req.auth) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // If already logged in and trying to access /admin/login → redirect to admin
  if (isLoginRoute && req.auth) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
