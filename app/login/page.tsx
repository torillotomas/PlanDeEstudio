"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [pass, setPass] = useState("");
    const [err, setErr] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr("");
        setLoading(true);

        try {
            const u = username.trim().toLowerCase();
            if (!u) throw new Error("Ingresá usuario");
            if (!pass) throw new Error("Ingresá contraseña");

            // 1) Validar que exista el username en profiles
            const { data: profile, error: pErr } = await supabase
                .from("profiles")
                .select("id, username")
                .eq("username", u)
                .single();

            if (pErr || !profile) throw new Error("Usuario inexistente");

            // 2) Email interno “fake” (no lo ve el usuario)
            const email = `${u}@planmap.local`;

            // 3) Login con Supabase Auth
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password: pass,
            });

            if (error) throw error;

            // 4) Ir al mapa
            router.replace("/map");
            router.refresh();
        } catch (e: any) {
            setErr(e?.message ?? "No se pudo iniciar sesión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
            <form
                onSubmit={onSubmit}
                style={{
                    width: 380,
                    maxWidth: "100%",
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "rgba(0,0,0,.35)",
                    borderRadius: 16,
                    padding: 16,
                    color: "#fff",
                }}
            >
                <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Ingresar</div>

                <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)", marginBottom: 6 }}>
                    Usuario
                </div>
                <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="usuario"
                    style={input}
                    autoComplete="username"
                />

                <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)", margin: "10px 0 6px" }}>
                    Contraseña
                </div>
                <input
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    style={input}
                    autoComplete="current-password"
                />

                {err && (
                    <div
                        style={{
                            marginTop: 10,
                            padding: 10,
                            borderRadius: 12,
                            background: "rgba(239,68,68,.12)",
                            border: "1px solid rgba(239,68,68,.25)",
                            fontSize: 12,
                            color: "rgba(254,202,202,.95)",
                        }}
                    >
                        {err}
                    </div>
                )}

                <button
                    disabled={loading || !username.trim() || !pass}
                    style={{
                        width: "100%",
                        marginTop: 12,
                        padding: "12px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(59,130,246,.45)",
                        background: "rgba(59,130,246,.18)",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.7 : 1,
                    }}
                >
                    {loading ? "Ingresando..." : "Entrar"}
                </button>

                <div style={{ marginTop: 10, fontSize: 11, color: "rgba(156,163,175,.95)" }}>
                    Tip: tu usuario no es mail. Internamente se usa <code>{`usuario@planmap.local`}</code>.
                </div>
            </form>
        </div>
    );
}

const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.35)",
    color: "#fff",
    outline: "none",
};