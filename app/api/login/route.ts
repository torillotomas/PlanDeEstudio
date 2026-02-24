import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { password } = await req.json().catch(() => ({ password: "" }));

    const real = process.env.APP_PASSWORD || "";
    const cookieName = process.env.APP_PASSWORD_COOKIE || "planmaterias_auth";

    if (!real || password !== real) {
        return NextResponse.json({ message: "Password incorrecta" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set(cookieName, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    return res;
}