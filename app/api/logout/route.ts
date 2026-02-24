import { NextResponse } from "next/server";

export async function POST() {
    const cookieName = process.env.APP_PASSWORD_COOKIE || "planmaterias_auth";
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieName, "", { path: "/", maxAge: 0 });
    return res;
}