import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;

  // Public routes
  const publicRoutes = ["/", "/login"];
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);

  // Shared interview routes (public access with token)
  const isSharedPage = nextUrl.pathname.startsWith("/shared/");
  const isSharedApi = nextUrl.pathname.startsWith("/api/interviews/share/");

  // Auth routes
  const isAuthRoute = nextUrl.pathname.startsWith("/login");

  // Admin routes
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");

  // Internal API routes — auth handled inside the route via x-internal-api-key
  const isInternalApi = nextUrl.pathname.startsWith('/api/internal/');
  if (isSharedPage || isSharedApi || isInternalApi) {
    return NextResponse.next();
  }

  // If not logged in and trying to access protected route
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // If logged in and trying to access auth routes, go to admin
  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  // Only admins can access admin routes
  if (isAdminRoute && isLoggedIn && session?.user?.role !== "admin") {
    return NextResponse.redirect(new URL("/unauthorized", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*|api/health).*)",
  ],
};
