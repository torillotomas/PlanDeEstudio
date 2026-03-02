"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import LogoutButton from "./LogoutButton";
import CareerTimeline from "./CareerTimeline";
import { supabase } from "@/lib/supabaseClient";

type PlanLite = { id: string; name: string };

export default function MapPage() {
    const router = useRouter();
    const pathname = usePathname();

    const [checking, setChecking] = useState(true);
    const [plan, setPlan] = useState<PlanLite | null>(null);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                // 1) Usuario
                const { data: userData, error: userErr } = await supabase.auth.getUser();
                if (userErr) throw userErr;

                const uid = userData?.user?.id;
                if (!uid) {
                    router.replace("/login");
                    return;
                }

                // 2) ¿Tiene plan?
                const { data, error: planErr } = await supabase
                    .from("plans")
                    .select("id,name")
                    .eq("owner_id", uid)
                    .order("created_at", { ascending: false })
                    .limit(1);

                if (planErr) throw planErr;

                const p = (data?.[0] ?? null) as PlanLite | null;

                if (!p?.id) {
                    router.replace("/create-plan");
                    return;
                }

                if (!alive) return;
                setPlan(p);
                setChecking(false);
            } catch {
                if (!alive) return;
                setChecking(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [router]);

    const title = useMemo(() => plan?.name ?? "Plan de materias", [plan?.name]);

    const NavLink = ({
        href,
        children,
    }: {
        href: string;
        children: React.ReactNode;
    }) => {
        const active = pathname === href;

        return (
            <Link
                href={href}
                style={{
                    textDecoration: "none",
                    borderRadius: 12,
                    padding: "8px 10px",
                    fontSize: 12,
                    fontWeight: 950,
                    color: active ? "#fff" : "rgba(229,231,235,.92)",
                    border: active
                        ? "1px solid rgba(59,130,246,.55)"
                        : "1px solid rgba(255,255,255,.10)",
                    background: active ? "rgba(59,130,246,.14)" : "rgba(255,255,255,.06)",
                    boxShadow: active ? "0 10px 28px rgba(59,130,246,.10)" : "none",
                    transition: "background .12s ease, border-color .12s ease",
                    whiteSpace: "nowrap",
                }}
            >
                {children}
            </Link>
        );
    };

    if (checking) {
        return (
            <main style={{ height: "100vh", overflow: "hidden" }}>
                <header
                    style={{
                        height: 64,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(255,255,255,.08)",
                        background: "rgba(0,0,0,.35)",
                        backdropFilter: "blur(10px)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <LogoutButton />
                        <div style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 950,
                                    color: "#fff",
                                    lineHeight: 1.1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Plan de materias
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(156,163,175,.95)" }}>
                                Cargando…
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                        <div
                            style={{
                                width: 84,
                                height: 34,
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,.10)",
                                background: "rgba(255,255,255,.06)",
                                opacity: 0.6,
                            }}
                        />
                        <div
                            style={{
                                width: 84,
                                height: 34,
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,.10)",
                                background: "rgba(255,255,255,.06)",
                                opacity: 0.6,
                            }}
                        />
                    </div>
                </header>

                <div style={{ height: "calc(100vh - 64px)", display: "grid", placeItems: "center" }}>
                    <div style={{ fontSize: 13, color: "rgba(156,163,175,.95)" }}>Cargando…</div>
                </div>
            </main>
        );
    }

    return (
        <main style={{ height: "100vh", overflow: "hidden" }}>
            {/* NAVBAR */}
            <header
                style={{
                    height: 64,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 14px",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                    background: "rgba(0,0,0,.35)",
                    backdropFilter: "blur(10px)",
                }}
            >
                {/* Left: logout + title */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <LogoutButton />
                    <div style={{ minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 950,
                                color: "#fff",
                                lineHeight: 1.1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                            title={title}
                        >
                            {title}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(156,163,175,.95)" }}>
                            Timeline • correlativas con flechas
                        </div>
                    </div>
                </div>

                {/* Right: nav */}
                <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <NavLink href="/map">Mapa</NavLink>
                    <NavLink href="/subjects">Materias</NavLink>
                    <NavLink href="/prereqs">Correlativas</NavLink>

                    <button
                        onClick={() => {
                            // refresh suave (reconsulta server components si hubiera)
                            router.refresh();
                        }}
                        style={{
                            border: "1px solid rgba(255,255,255,.10)",
                            background: "rgba(255,255,255,.06)",
                            color: "#fff",
                            borderRadius: 12,
                            padding: "8px 10px",
                            cursor: "pointer",
                            fontWeight: 950,
                            fontSize: 12,
                            whiteSpace: "nowrap",
                        }}
                        title="Refrescar"
                    >
                        Refrescar
                    </button>
                </nav>
            </header>

            {/* CONTENT */}
            <div style={{ height: "calc(100vh - 64px)" }}>
                <CareerTimeline />
            </div>
        </main>
    );
}