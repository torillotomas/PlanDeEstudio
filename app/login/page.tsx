"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const params = useSearchParams();
    const next = params.get("next") || "/";

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErr("");

        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password }),
        });

        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            setErr(j?.message ?? "Password incorrecta");
            setLoading(false);
            return;
        }

        router.replace(next);
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                background: "#0b0b0b",
                color: "#fff",
                padding: 16,
            }}
        >
            <form
                onSubmit={submit}
                style={{
                    width: "100%",
                    maxWidth: 380,
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "rgba(255,255,255,.03)",
                    borderRadius: 16,
                    padding: 18,
                }}
            >
                <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
                    Plan Materias
                </div>
                <div style={{ color: "rgba(156,163,175,.95)", fontSize: 13, marginBottom: 14 }}>
                    Ingresá la contraseña para acceder.
                </div>

                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña"
                    style={{
                        width: "100%",
                        padding: "12px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(0,0,0,.35)",
                        color: "#fff",
                        outline: "none",
                    }}
                />

                {err && (
                    <div style={{ marginTop: 10, color: "rgba(248,113,113,.95)", fontSize: 12 }}>
                        {err}
                    </div>
                )}

                <button
                    disabled={loading}
                    style={{
                        marginTop: 12,
                        width: "100%",
                        padding: "12px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(59,130,246,.45)",
                        background: "rgba(59,130,246,.18)",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                        opacity: loading ? 0.8 : 1,
                    }}
                >
                    {loading ? "Ingresando..." : "Entrar"}
                </button>
            </form>
        </div>
    );
}