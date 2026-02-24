import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = process.env.APP_PASSWORD_COOKIE || "planmaterias_auth";

// Paths que NO se protegen
const PUBLIC_PATHS = [
    "/login",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
];

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // permitir assets internos de Next
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        PUBLIC_PATHS.some((p) => pathname === p)
    ) {
        return NextResponse.next();
    }

    const ok = req.cookies.get(COOKIE_NAME)?.value === "1";

    if (ok) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
}

// Protege todo menos login y assets
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};