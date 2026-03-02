"use client";

import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useMyPlan } from "@/lib/career/useMyPlan";
import { useRouter } from "next/navigation";

type SubjectRow = {
    id: string;
    name: string;
    year: number;
    period_key: string;
    order_in_cell: number;
};

type PrereqType = "rendir" | "cursar";

type PrereqRow = {
    subject_id: string;
    prereq_subject_id: string;
    prereq_type: PrereqType;
};

export default function PrereqsPage() {
    const router = useRouter();
    const { loading: planLoading, error: planError, plan, planId } = useMyPlan();

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string>("");

    const [subjects, setSubjects] = useState<SubjectRow[]>([]);
    const [prereqs, setPrereqs] = useState<PrereqRow[]>([]);
    const [loadedOnce, setLoadedOnce] = useState(false);

    // form
    const [subjectId, setSubjectId] = useState<string>("");
    const [prereqId, setPrereqId] = useState<string>("");
    const [prereqType, setPrereqType] = useState<PrereqType>("rendir");

    const canSave = useMemo(() => {
        if (!planId) return false;
        if (!subjectId || !prereqId) return false;
        if (subjectId === prereqId) return false;
        return true;
    }, [planId, subjectId, prereqId]);

    const loadAll = async () => {
        if (!planId) return;
        setLoading(true);
        setErr("");

        try {
            const { data: subs, error: subsErr } = await supabase
                .from("subjects")
                .select("id,name,year,period_key,order_in_cell")
                .eq("plan_id", planId)
                .order("year", { ascending: true })
                .order("period_key", { ascending: true })
                .order("order_in_cell", { ascending: true });

            if (subsErr) throw subsErr;

            const { data: prs, error: prsErr } = await supabase
                .from("subject_prereq")
                .select("subject_id,prereq_subject_id,prereq_type");

            if (prsErr) throw prsErr;

            setSubjects((subs ?? []) as SubjectRow[]);
            setPrereqs((prs ?? []) as PrereqRow[]);
            setLoadedOnce(true);

            // defaults cómodos
            const first = (subs ?? [])[0] as any;
            if (first?.id && !subjectId) setSubjectId(first.id);
            if (first?.id && !prereqId) setPrereqId(first.id);
        } catch (e: any) {
            setErr(e?.message ?? "Error cargando datos");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (!planId) return;
        if (loadedOnce) return;
        void loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planId]);

    const subjectNameById = useMemo(() => {
        const m = new Map<string, string>();
        for (const s of subjects) m.set(s.id, s.name);
        return m;
    }, [subjects]);

    const addPrereq = async () => {
        if (!planId) return;
        setLoading(true);
        setErr("");

        try {
            // no duplicar
            const exists = prereqs.some(
                (p) =>
                    p.subject_id === subjectId &&
                    p.prereq_subject_id === prereqId &&
                    String(p.prereq_type) === String(prereqType)
            );
            if (exists) {
                throw new Error("Esa correlativa ya existe.");
            }

            const payload = {
                subject_id: subjectId,
                prereq_subject_id: prereqId,
                prereq_type: prereqType,
            };

            const { error } = await supabase.from("subject_prereq").insert(payload);
            if (error) throw error;

            await loadAll();
        } catch (e: any) {
            setErr(e?.message ?? "Error guardando correlativa");
        } finally {
            setLoading(false);
        }
    };

    const removePrereq = async (row: PrereqRow) => {
        if (!confirm("¿Borrar correlativa?")) return;

        setLoading(true);
        setErr("");

        try {
            const { error } = await supabase
                .from("subject_prereq")
                .delete()
                .eq("subject_id", row.subject_id)
                .eq("prereq_subject_id", row.prereq_subject_id)
                .eq("prereq_type", row.prereq_type);

            if (error) throw error;

            await loadAll();
        } catch (e: any) {
            setErr(e?.message ?? "Error borrando correlativa");
        } finally {
            setLoading(false);
        }
    };

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
                <button onClick={() => router.push("/create-plan")} style={btnPrimary}>
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
                        <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>Correlativas</div>
                        <div style={{ fontSize: 18, fontWeight: 950, color: "#fff" }}>{plan.name}</div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => router.push("/subjects")} style={btnGhost}>
                            Materias
                        </button>
                        <button onClick={() => router.push("/map")} style={btnGhost}>
                            Volver
                        </button>
                    </div>
                </div>

                {/* Form */}
                <div
                    style={{
                        marginTop: 16,
                        padding: 14,
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,.10)",
                        background: "rgba(0,0,0,.28)",
                    }}
                >
                    <div style={{ fontSize: 14, fontWeight: 950, color: "rgba(229,231,235,.92)" }}>
                        Agregar correlativa
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 10 }}>
                        <div>
                            <div style={label}>Materia</div>
                            <div style={selectWrap}>
                                <select
                                    value={subjectId}
                                    onChange={(e) => setSubjectId(e.target.value)}
                                    style={select}
                                    disabled={loading}
                                >
                                    <option value="" disabled style={optionStyleHint as any}>
                                        -- Elegí --
                                    </option>
                                    {subjects.map((s) => (
                                        <option key={s.id} value={s.id} style={optionStyleHint as any}>
                                            {`Año ${s.year} • ${s.name}`}
                                        </option>
                                    ))}
                                </select>
                                <span style={selectArrow}>▾</span>
                            </div>
                        </div>

                        <div>
                            <div style={label}>Requiere</div>
                            <div style={selectWrap}>
                                <select
                                    value={prereqId}
                                    onChange={(e) => setPrereqId(e.target.value)}
                                    style={select}
                                    disabled={loading}
                                >
                                    <option value="" disabled style={optionStyleHint as any}>
                                        -- Elegí --
                                    </option>
                                    {subjects.map((s) => (
                                        <option key={s.id} value={s.id} style={optionStyleHint as any}>
                                            {`Año ${s.year} • ${s.name}`}
                                        </option>
                                    ))}
                                </select>
                                <span style={selectArrow}>▾</span>
                            </div>
                        </div>

                        <div>
                            <div style={label}>Tipo</div>
                            <div style={selectWrap}>
                                <select
                                    value={prereqType}
                                    onChange={(e) => setPrereqType(e.target.value as PrereqType)}
                                    style={select}
                                    disabled={loading}
                                >
                                    <option value="rendir" style={optionStyleHint as any}>
                                        Rendir
                                    </option>
                                    <option value="cursar" style={optionStyleHint as any}>
                                        Cursar
                                    </option>
                                </select>
                                <span style={selectArrow}>▾</span>
                            </div>
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

                    <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button onClick={loadAll} disabled={loading} style={btnGhost}>
                            Refrescar
                        </button>

                        <button onClick={addPrereq} disabled={!canSave || loading} style={btnPrimary}>
                            {loading ? "Guardando…" : "Agregar correlativa"}
                        </button>
                    </div>
                </div>

                {/* List */}
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "rgba(209,213,219,.85)" }}>
                        Correlativas ({prereqs.length})
                    </div>

                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        {prereqs.length === 0 ? (
                            <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>
                                Todavía no cargaste correlativas.
                            </div>
                        ) : (
                            prereqs.map((p, idx) => (
                                <div
                                    key={`${p.prereq_subject_id}-${p.subject_id}-${p.prereq_type}-${idx}`}
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
                                        <div
                                            style={{
                                                fontWeight: 900,
                                                color: "#fff",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {subjectNameById.get(p.subject_id) ?? p.subject_id}
                                        </div>
                                        <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>
                                            Requiere: <b>{subjectNameById.get(p.prereq_subject_id) ?? p.prereq_subject_id}</b> • tipo{" "}
                                            <b>{p.prereq_type}</b>
                                        </div>
                                    </div>

                                    <button onClick={() => removePrereq(p)} disabled={loading} style={btnDanger}>
                                        Borrar
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ marginTop: 10, fontSize: 11, color: "rgba(156,163,175,.95)" }}>
                        Nota: por ahora mostramos todas las correlativas de la tabla (como tu Timeline ya filtra “rendir” para flechas).
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

/** ✅ wrapper + flecha */
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

/** ✅ select “custom” */
const select: React.CSSProperties = {
    width: "100%",
    padding: "10px 36px 10px 12px", // deja lugar para la flecha
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.45)",
    color: "#fff",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
};

/** ⚠️ no siempre aplica al dropdown, pero ayuda en varios casos */
const optionStyleHint: React.CSSProperties = {
    background: "#0b0b0b",
    color: "#fff",
};

const btnGhost: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    color: "#fff",
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
};

const btnPrimary: React.CSSProperties = {
    border: "1px solid rgba(59,130,246,.45)",
    background: "rgba(59,130,246,.18)",
    color: "#fff",
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
    whiteSpace: "nowrap",
};

const btnDanger: React.CSSProperties = {
    border: "1px solid rgba(239,68,68,.45)",
    background: "rgba(239,68,68,.12)",
    color: "#fff",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    flexShrink: 0,
};