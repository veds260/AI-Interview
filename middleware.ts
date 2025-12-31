import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const userRole = session?.user?.role;

  // Public routes
  const publicRoutes = ["/", "/login", "/register"];
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);

  // Shared interview routes (public access with token)
  const isSharedInterviewPage = nextUrl.pathname.match(/^\/interview\/[a-f0-9]+$/);
  const isSharedInterviewApi = nextUrl.pathname.startsWith("/api/interviews/share/");

  // Auth routes (login, register)
  const isAuthRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register");

  // Protected route patterns
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isClientRoute = nextUrl.pathname.startsWith("/client");
  const isWriterRoute = nextUrl.pathname.startsWith("/writer");
  const isInterviewRoute = nextUrl.pathname.startsWith("/interview") && !isSharedInterviewPage;

  // Allow public access to shared interview routes
  if (isSharedInterviewPage || isSharedInterviewApi) {
    return NextResponse.next();
  }

  // If not logged in and trying to access protected route
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // If logged in and trying to access auth routes
  if (isLoggedIn && isAuthRoute) {
    // Redirect to appropriate dashboard based on role
    if (userRole === "admin") {
      return NextResponse.redirect(new URL("/admin", nextUrl));
    }
    if (userRole === "writer") {
      return NextResponse.redirect(new URL("/writer", nextUrl));
    }
    return NextResponse.redirect(new URL("/client", nextUrl));
  }

  // Role-based access control
  if (isLoggedIn) {
    // Admin routes - only admins
    if (isAdminRoute && userRole !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }

    // Writer routes - only writers and admins
    if (isWriterRoute && userRole !== "writer" && userRole !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }

    // Client routes - only clients and admins
    if (isClientRoute && userRole !== "client" && userRole !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }

    // Interview routes - clients and admins
    if (isInterviewRoute && userRole !== "client" && userRole !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*|api/health).*)",
  ],
};
