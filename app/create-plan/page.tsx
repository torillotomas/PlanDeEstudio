"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Mode = "cuatrimestral" | "anual";

export default function CreatePlanPage() {
    const router = useRouter();

    const [title, setTitle] = useState("Tecnicatura en Informática Aplicada");
    const [mode, setMode] = useState<Mode>("cuatrimestral");
    const [yearsCount, setYearsCount] = useState<number>(3);
    const [periods, setPeriods] = useState<string>(mode === "cuatrimestral" ? "1C,2C" : "ANUAL");

    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string>("");

    // mantener periods coherente cuando cambia mode
    React.useEffect(() => {
        setPeriods(mode === "cuatrimestral" ? "1C,2C" : "ANUAL");
    }, [mode]);

    const canSave = useMemo(() => {
        if (title.trim().length < 3) return false;
        if (!Number.isFinite(yearsCount) || yearsCount < 1 || yearsCount > 10) return false;
        if (periods.trim().length === 0) return false;
        return true;
    }, [title, yearsCount, periods]);

    const createPlan = async () => {
        setSaving(true);
        setErr("");

        try {
            const { data: userData, error: userErr } = await supabase.auth.getUser();
            if (userErr) throw userErr;

            const uid = userData?.user?.id;
            if (!uid) throw new Error("No hay usuario autenticado");

            // Insert en plans (por usuario)
            const MODE_DB: Record<Mode, string> = {
                anual: "annual",
                cuatrimestral: "periodic",
            };

            const payload = {
                owner_id: uid,
                name: title.trim(),
                mode: MODE_DB[mode], // ✅ ahora coincide con el CHECK
                years_count: yearsCount,
                periods: periods.trim(),
            };
            const { error: insErr } = await supabase.from("plans").insert(payload);
            if (insErr) throw insErr;

            // volver al mapa/timeline
            router.push("/map");
            router.refresh();
        } catch (e: any) {
            setErr(e?.message ?? "Error creando carrera");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main style={{ height: "100vh", display: "grid", placeItems: "center", padding: 18 }}>
            <div
                style={{
                    width: "min(720px, 100%)",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "rgba(0,0,0,.35)",
                    backdropFilter: "blur(10px)",
                    padding: 18,
                    color: "#fff",
                }}
            >
                <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: 0.2 }}>Crear carrera</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(156,163,175,.95)" }}>
                    Primero creamos tu plan (título + estructura). Después cargamos las materias.
                </div>

                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                    <div>
                        <div style={label}>Título</div>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej: Tecnicatura en Informática Aplicada"
                            style={input}
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                            <div style={label}>Modo</div>
                            <div style={selectWrap}>
                                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={select}>
                                    <option value="cuatrimestral">Cuatrimestral</option>
                                    <option value="anual">Anual</option>
                                </select>
                                <span style={selectArrow}>▾</span>
                            </div>
                            <div style={help}>
                                {mode === "cuatrimestral" ? "Ej: 1C y 2C por año." : "Ej: un período anual por año."}
                            </div>
                        </div>

                        <div>
                            <div style={label}>Años</div>
                            <input
                                value={String(yearsCount)}
                                onChange={(e) => setYearsCount(Number(e.target.value))}
                                inputMode="numeric"
                                style={input}
                            />
                            <div style={help}>1 a 10 (después lo podés editar).</div>
                        </div>
                    </div>

                    <div>
                        <div style={label}>Períodos</div>
                        <input
                            value={periods}
                            onChange={(e) => setPeriods(e.target.value)}
                            placeholder={mode === "cuatrimestral" ? "1C,2C" : "ANUAL"}
                            style={input}
                        />
                        <div style={help}>
                            Guardamos texto simple (ej: <b>1C,2C</b> o <b>ANUAL</b>). Luego lo usamos para armar el alta de materias.
                        </div>
                    </div>

                    {err && (
                        <div
                            style={{
                                padding: 10,
                                borderRadius: 12,
                                background: "rgba(239,68,68,.12)",
                                border: "1px solid rgba(239,68,68,.25)",
                                color: "rgba(254,202,202,.95)",
                                fontSize: 12,
                            }}
                        >
                            {err}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                        <button
                            onClick={() => router.push("/map")}
                            style={{
                                border: "1px solid rgba(255,255,255,.12)",
                                background: "rgba(255,255,255,.06)",
                                color: "#fff",
                                borderRadius: 12,
                                padding: "10px 12px",
                                cursor: "pointer",
                                fontWeight: 900,
                                fontSize: 12,
                            }}
                        >
                            Cancelar
                        </button>

                        <button
                            onClick={createPlan}
                            disabled={!canSave || saving}
                            style={{
                                border: "1px solid rgba(59,130,246,.45)",
                                background: canSave ? "rgba(59,130,246,.18)" : "rgba(59,130,246,.08)",
                                color: "#fff",
                                borderRadius: 12,
                                padding: "10px 12px",
                                cursor: canSave ? "pointer" : "not-allowed",
                                fontWeight: 950,
                                fontSize: 12,
                                opacity: saving ? 0.75 : 1,
                            }}
                        >
                            {saving ? "Creando…" : "Crear carrera"}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}

const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(229,231,235,.92)",
    marginBottom: 6,
};

const help: React.CSSProperties = {
    marginTop: 6,
    fontSize: 11,
    color: "rgba(156,163,175,.95)",
};

const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.35)",
    color: "#fff",
    outline: "none",
};

const selectWrap: React.CSSProperties = { position: "relative", width: "100%" };
const selectArrow: React.CSSProperties = {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "rgba(156,163,175,.95)",
    fontSize: 14,
};

const select: React.CSSProperties = {
    width: "100%",
    padding: "10px 36px 10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.35)",
    color: "#fff",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
};