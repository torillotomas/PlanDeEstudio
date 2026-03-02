"use client";

import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useMyPlan } from "@/lib/career/useMyPlan";
import { useRouter } from "next/navigation";

type SubjectRow = {
    id: string;
    plan_id: string;
    name: string;
    year: number;
    period_key: string;
    order_in_cell: number;
    created_at: string;
};

type PeriodKey = "1C" | "2C";

export default function SubjectsPage() {
    const router = useRouter();
    const { loading: planLoading, error: planError, plan, planId } = useMyPlan();

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string>("");

    const [subjects, setSubjects] = useState<SubjectRow[]>([]);
    const [loadedOnce, setLoadedOnce] = useState(false);

    // form (single)
    const [name, setName] = useState("");
    const [year, setYear] = useState<number>(1);
    const [periodPick, setPeriodPick] = useState<PeriodKey>("1C"); // solo si plan.mode === "periodic"

    // bulk list
    const [bulkText, setBulkText] = useState("");

    const maxYears = useMemo(() => {
        const n = Number(plan?.years_count ?? 10);
        return Number.isFinite(n) && n >= 1 ? n : 10;
    }, [plan?.years_count]);

    const periodKey = useMemo(() => {
        if (!plan) return "1C";
        return plan.mode === "annual" ? "ANUAL" : periodPick;
    }, [plan, periodPick]);

    const canCreateSingle = useMemo(() => {
        if (!planId || !plan) return false;
        if (name.trim().length < 2) return false;
        if (!Number.isFinite(year) || year < 1 || year > maxYears) return false;
        if (plan.mode === "periodic" && (periodPick !== "1C" && periodPick !== "2C")) return false;
        return true;
    }, [planId, plan, name, year, maxYears, periodPick]);

    const bulkNames = useMemo(() => {
        // una materia por línea (ignoramos vacías)
        return bulkText
            .split("\n")
            .map((x) => x.trim())
            .filter((x) => x.length > 0);
    }, [bulkText]);

    const canCreateBulk = useMemo(() => {
        if (!planId || !plan) return false;
        if (!Number.isFinite(year) || year < 1 || year > maxYears) return false;
        if (plan.mode === "periodic" && (periodPick !== "1C" && periodPick !== "2C")) return false;
        if (bulkNames.length === 0) return false;
        return true;
    }, [planId, plan, year, maxYears, periodPick, bulkNames.length]);

    const loadSubjects = async () => {
        if (!planId) return;
        setLoading(true);
        setErr("");

        try {
            const { data, error } = await supabase
                .from("subjects")
                .select("id,plan_id,name,year,period_key,order_in_cell,created_at")
                .eq("plan_id", planId)
                .order("year", { ascending: true })
                .order("period_key", { ascending: true })
                .order("order_in_cell", { ascending: true });

            if (error) throw error;
            setSubjects((data ?? []) as SubjectRow[]);
            setLoadedOnce(true);
        } catch (e: any) {
            setErr(e?.message ?? "Error cargando materias");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (!planId) return;
        if (loadedOnce) return;
        void loadSubjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planId]);

    const computeNextOrder = async (plan_id: string, y: number, pkey: string) => {
        const { data, error } = await supabase
            .from("subjects")
            .select("order_in_cell")
            .eq("plan_id", plan_id)
            .eq("year", y)
            .eq("period_key", pkey)
            .order("order_in_cell", { ascending: false })
            .limit(1);

        if (error) throw error;
        const last = (data?.[0]?.order_in_cell ?? 0) as number;
        return last + 1;
    };

    const createSubject = async () => {
        if (!planId || !plan) return;
        setLoading(true);
        setErr("");

        try {
            const pkey = periodKey;
            const nextOrder = await computeNextOrder(planId, year, pkey);

            const payload = {
                plan_id: planId,
                name: name.trim(),
                year,
                period_key: pkey,
                order_in_cell: nextOrder,
            };

            const { error } = await supabase.from("subjects").insert(payload);
            if (error) throw error;

            setName(""); // ✅ limpio el input
            await loadSubjects();
        } catch (e: any) {
            setErr(e?.message ?? "Error creando materia");
        } finally {
            setLoading(false);
        }
    };

    const createBulkSubjects = async () => {
        if (!planId || !plan) return;
        setLoading(true);
        setErr("");

        try {
            const pkey = periodKey;

            // 1) next order base
            const baseOrder = await computeNextOrder(planId, year, pkey);

            // 2) construir insert array con orden incremental
            const payloads = bulkNames.map((n, idx) => ({
                plan_id: planId,
                name: n,
                year,
                period_key: pkey,
                order_in_cell: baseOrder + idx,
            }));

            const { error } = await supabase.from("subjects").insert(payloads);
            if (error) throw error;

            setBulkText(""); // ✅ limpio textarea
            await loadSubjects();
        } catch (e: any) {
            setErr(e?.message ?? "Error creando materias (lista)");
        } finally {
            setLoading(false);
        }
    };

    const deleteSubject = async (row: SubjectRow) => {
        if (!confirm(`¿Borrar "${row.name}"?`)) return;

        setLoading(true);
        setErr("");

        try {
            const { error } = await supabase.from("subjects").delete().eq("id", row.id);
            if (error) throw error;
            await loadSubjects();
        } catch (e: any) {
            setErr(e?.message ?? "Error borrando materia");
        } finally {
            setLoading(false);
        }
    };

    // ====== UI STATES ======
    if (planLoading) {
        return (
            <main style={{ height: "100vh", display: "grid", placeItems: "center" }}>
                <div style={{ fontSize: 13, color: "rgba(156,163,175,.95)" }}>Cargando…</div>
            </main>
        );
    }

    if (planError) {
        return (
            <main style={{ height: "100vh", padding: 18 }}>
                <div
                    style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "rgba(239,68,68,.12)",
                        border: "1px solid rgba(239,68,68,.25)",
                        color: "rgba(254,202,202,.95)",
                        fontSize: 12,
                        maxWidth: 720,
                    }}
                >
                    {planError}
                </div>
            </main>
        );
    }

    if (!planId || !plan) {
        return (
            <main style={{ height: "100vh", padding: 18 }}>
                <div style={{ fontWeight: 900, color: "rgba(229,231,235,.92)" }}>No tenés un plan todavía.</div>
                <button
                    onClick={() => router.push("/create-plan")}
                    style={{
                        marginTop: 12,
                        border: "1px solid rgba(59,130,246,.45)",
                        background: "rgba(59,130,246,.18)",
                        color: "#fff",
                        borderRadius: 12,
                        padding: "10px 12px",
                        cursor: "pointer",
                        fontWeight: 900,
                        fontSize: 12,
                    }}
                >
                    Crear carrera
                </button>
            </main>
        );
    }

    return (
        <main style={{ height: "100vh", overflow: "auto", padding: 18 }}>
            <div style={{ maxWidth: 980, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>Plan</div>
                        <div style={{ fontSize: 18, fontWeight: 950, color: "#fff" }}>{plan.name}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "rgba(156,163,175,.95)" }}>
                            Modo: <b>{plan.mode === "annual" ? "Anual" : "Cuatrimestral"}</b> • Años: <b>{plan.years_count}</b>
                        </div>
                    </div>

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
                            whiteSpace: "nowrap",
                        }}
                    >
                        Volver al mapa
                    </button>
                </div>

                {/* Agregar materia (single) */}
                <div
                    style={{
                        marginTop: 16,
                        padding: 14,
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,.10)",
                        background: "rgba(0,0,0,.28)",
                    }}
                >
                    <div style={{ fontSize: 14, fontWeight: 950, color: "rgba(229,231,235,.92)" }}>Agregar materia</div>

                    {/* Controls comunes */}
                    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: plan.mode === "periodic" ? "1fr 160px 160px" : "1fr 160px", gap: 10 }}>
                        <div>
                            <div style={label}>Nombre (Enter guarda)</div>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej: Programación I"
                                style={input}
                                onKeyDown={(e) => {
                                    if (e.key !== "Enter") return;
                                    e.preventDefault();
                                    if (loading) return;
                                    if (!canCreateSingle) return;
                                    void createSubject();
                                }}
                            />
                        </div>

                        <div>
                            <div style={label}>Año</div>
                            <input value={String(year)} onChange={(e) => setYear(Number(e.target.value))} inputMode="numeric" style={input} />
                            <div style={{ marginTop: 6, fontSize: 11, color: "rgba(156,163,175,.95)" }}>1..{maxYears}</div>
                        </div>

                        {plan.mode === "periodic" && (
                            <div>
                                <div style={label}>Período</div>
                                <div style={{ position: "relative" }}>
                                    <select value={periodPick} onChange={(e) => setPeriodPick(e.target.value as PeriodKey)} style={select} disabled={loading}>
                                        <option value="1C">1C</option>
                                        <option value="2C">2C</option>
                                    </select>
                                    <span style={selectArrow}>▾</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {plan.mode === "annual" && (
                        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(156,163,175,.95)" }}>
                            Período: <b>ANUAL</b> (automático)
                        </div>
                    )}

                    {/* Acciones single */}
                    <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button
                            onClick={loadSubjects}
                            disabled={loading}
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
                            Refrescar
                        </button>

                        <button
                            onClick={createSubject}
                            disabled={!canCreateSingle || loading}
                            style={{
                                border: "1px solid rgba(59,130,246,.45)",
                                background: canCreateSingle ? "rgba(59,130,246,.18)" : "rgba(59,130,246,.08)",
                                color: "#fff",
                                borderRadius: 12,
                                padding: "10px 12px",
                                cursor: canCreateSingle ? "pointer" : "not-allowed",
                                fontWeight: 950,
                                fontSize: 12,
                                opacity: loading ? 0.75 : 1,
                            }}
                        >
                            {loading ? "Guardando…" : "Agregar"}
                        </button>
                    </div>

                    {/* Bulk list */}
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.08)" }}>
                        <div style={{ fontSize: 13, fontWeight: 950, color: "rgba(229,231,235,.92)" }}>
                            Cargar por lista (una materia por línea)
                        </div>

                        <textarea
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            placeholder={"Ej:\nMatemática I\nProgramación I\nInglés I"}
                            style={{
                                width: "100%",
                                marginTop: 10,
                                minHeight: 120,
                                resize: "vertical",
                                padding: 12,
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,.12)",
                                background: "rgba(0,0,0,.35)",
                                color: "#fff",
                                outline: "none",
                                lineHeight: 1.4,
                            }}
                            disabled={loading}
                        />

                        <div style={{ marginTop: 8, fontSize: 11, color: "rgba(156,163,175,.95)" }}>
                            Se van a guardar en: Año <b>{year}</b> • Período <b>{periodKey}</b> • Orden automático <b>max+1</b>.
                            <br />
                            Líneas detectadas: <b>{bulkNames.length}</b>
                        </div>

                        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                            <button
                                onClick={createBulkSubjects}
                                disabled={!canCreateBulk || loading}
                                style={{
                                    border: "1px solid rgba(59,130,246,.45)",
                                    background: canCreateBulk ? "rgba(59,130,246,.18)" : "rgba(59,130,246,.08)",
                                    color: "#fff",
                                    borderRadius: 12,
                                    padding: "10px 12px",
                                    cursor: canCreateBulk ? "pointer" : "not-allowed",
                                    fontWeight: 950,
                                    fontSize: 12,
                                    opacity: loading ? 0.75 : 1,
                                }}
                            >
                                {loading ? "Guardando…" : "Agregar lista"}
                            </button>
                        </div>
                    </div>

                    {err && (
                        <div
                            style={{
                                marginTop: 12,
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
                </div>

                {/* Lista */}
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "rgba(209,213,219,.85)" }}>
                        Materias ({subjects.length})
                    </div>

                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        {subjects.length === 0 ? (
                            <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>Todavía no cargaste materias.</div>
                        ) : (
                            subjects.map((s) => (
                                <div
                                    key={s.id}
                                    style={{
                                        padding: 10,
                                        borderRadius: 14,
                                        border: "1px solid rgba(255,255,255,.10)",
                                        background: "rgba(0,0,0,.22)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 10,
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {s.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>
                                            Año {s.year} • {s.period_key} • orden {s.order_in_cell}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => deleteSubject(s)}
                                        disabled={loading}
                                        style={{
                                            border: "1px solid rgba(239,68,68,.45)",
                                            background: "rgba(239,68,68,.12)",
                                            color: "#fff",
                                            borderRadius: 12,
                                            padding: "8px 10px",
                                            cursor: "pointer",
                                            fontWeight: 900,
                                            fontSize: 12,
                                            flexShrink: 0,
                                        }}
                                    >
                                        Borrar
                                    </button>
                                </div>
                            ))
                        )}
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

const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.35)",
    color: "#fff",
    outline: "none",
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

const selectArrow: React.CSSProperties = {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "rgba(156,163,175,.95)",
    fontSize: 14,
};