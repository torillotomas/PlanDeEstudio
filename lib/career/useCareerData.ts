"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    computeSubjectStatus,
    type NodeStatus,
    type Status,
} from "@/lib/career/computeSubjectStatus";

type SubjectRow = {
    id: string;
    name: string;
    year: number;
    period_key: string;
    order_in_cell: number;
};

type PrereqRow = {
    subject_id: string;
    prereq_subject_id: string;
    prereq_type: "rendir" | "cursar" | string;
};

type StatusRow = {
    subject_id: string;
    status: Status;
    grade: number | null;
    passed_via: "promo" | "final" | null;
};

export type PassedVia = "promo" | "final";

export type SubjectComputed = {
    id: string;
    name: string;
    year: number;
    period_key: string;
    order_in_cell: number;

    // correlativas (solo "rendir")
    prereqIds: string[];
    hasPrereqs: boolean;
    allApproved: boolean;

    // estado usuario
    userStatus: Status; // default "pendiente"
    grade: number | null;
    passedVia: PassedVia | null;

    // estado calculado (lo que usabas para pintar)
    computedStatus: NodeStatus;

    // UI helper (igual a CareerMap)
    subtitle?: string;
};

export function useCareerData(planId: string) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");

    const [subjectsRaw, setSubjectsRaw] = useState<SubjectRow[]>([]);
    const [prereqsRaw, setPrereqsRaw] = useState<PrereqRow[]>([]);
    const [statusesRaw, setStatusesRaw] = useState<StatusRow[]>([]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = () => setRefreshKey((k) => k + 1);
    const clearSelection = () => setSelectedId(null);

    // =========================
    // FETCH (misma data que CareerMap)
    // =========================
    useEffect(() => {
        let alive = true;

        (async () => {
            setLoading(true);
            setError("");

            try {
                // 1) Materias
                const { data: subjects, error: subjErr } = await supabase
                    .from("subjects")
                    .select("id,name,year,period_key,order_in_cell")
                    .eq("plan_id", planId)
                    .order("year", { ascending: true })
                    .order("order_in_cell", { ascending: true });

                if (!alive) return;
                if (subjErr) throw subjErr;

                // 2) Correlativas
                const { data: prereqs, error: preErr } = await supabase
                    .from("subject_prereq")
                    .select("subject_id, prereq_subject_id, prereq_type");

                if (!alive) return;
                if (preErr) throw preErr;

                // 3) Estados
                const { data: statuses, error: stErr } = await supabase
                    .from("user_subject_status")
                    .select("subject_id,status,grade,passed_via");

                if (!alive) return;
                if (stErr) throw stErr;

                setSubjectsRaw((subjects ?? []) as SubjectRow[]);
                setPrereqsRaw((prereqs ?? []) as PrereqRow[]);
                setStatusesRaw((statuses ?? []) as StatusRow[]);
            } catch (e: any) {
                if (!alive) return;
                setError(e?.message ?? "Error cargando datos");
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [planId, refreshKey]);

    // =========================
    // MAPS (igual que en CareerMap)
    // =========================
    const statusById = useMemo(() => {
        const m = new Map<string, Status>();
        for (const row of statusesRaw) m.set(row.subject_id, row.status);
        return m;
    }, [statusesRaw]);

    const gradeById = useMemo(() => {
        const m = new Map<string, number | null>();
        for (const row of statusesRaw) m.set(row.subject_id, row.grade ?? null);
        return m;
    }, [statusesRaw]);

    const passedById = useMemo(() => {
        const m = new Map<string, PassedVia | null>();
        for (const row of statusesRaw) m.set(row.subject_id, (row.passed_via ?? null) as any);
        return m;
    }, [statusesRaw]);

    // Solo correlativas tipo "rendir"
    const prereqsRendir = useMemo(() => {
        return prereqsRaw.filter(
            (r) => String(r.prereq_type ?? "").trim().toLowerCase() === "rendir"
        );
    }, [prereqsRaw]);

    const prereqsBySubject = useMemo(() => {
        const m = new Map<string, string[]>();
        for (const r of prereqsRendir) {
            const arr = m.get(r.subject_id) ?? [];
            arr.push(r.prereq_subject_id);
            m.set(r.subject_id, arr);
        }
        return m;
    }, [prereqsRendir]);

    // =========================
    // SUBJECTS ENRICHED (computedStatus + subtitle)
    // =========================
    const subjects: SubjectComputed[] = useMemo(() => {
        return subjectsRaw.map((subj) => {
            const userStatus = statusById.get(subj.id) ?? "pendiente";
            const prereqIds = prereqsBySubject.get(subj.id) ?? [];
            const hasPrereqs = prereqIds.length > 0;
            const allApproved = prereqIds.every(
                (pr) => (statusById.get(pr) ?? "pendiente") === "aprobada"
            );

            const computedStatus = computeSubjectStatus({
                userStatus,
                hasPrereqs,
                allPrereqsApproved: allApproved,
            });

            const grade = gradeById.get(subj.id) ?? null;
            const passedVia = passedById.get(subj.id) ?? null;

            // Igual a tu lógica actual de subtitle
            const subtitle =
                computedStatus === "aprobada" && grade != null
                    ? `${grade.toFixed(2)} • ${passedVia === "promo" ? "Promo" : "Final"}`
                    : computedStatus === "final_pendiente"
                        ? "Final pendiente"
                        : computedStatus === "cursando"
                            ? "Cursando"
                            : computedStatus === "disponible" && hasPrereqs
                                ? "Puedo rendir"
                                : undefined;

            return {
                id: subj.id,
                name: subj.name,
                year: subj.year,
                period_key: subj.period_key,
                order_in_cell: subj.order_in_cell,

                prereqIds,
                hasPrereqs,
                allApproved,

                userStatus,
                grade,
                passedVia,

                computedStatus,
                subtitle,
            };
        });
    }, [subjectsRaw, statusById, gradeById, passedById, prereqsBySubject]);

    // Años existentes
    const years = useMemo(() => {
        return Array.from(new Set(subjects.map((s) => s.year))).sort((a, b) => a - b);
    }, [subjects]);

    // Para Timeline: agrupar por año
    const subjectsByYear = useMemo(() => {
        const m = new Map<number, SubjectComputed[]>();
        for (const s of subjects) {
            const arr = m.get(s.year) ?? [];
            arr.push(s);
            m.set(s.year, arr);
        }
        return m;
    }, [subjects]);

    // =========================
    // PANEL (misma derivación que CareerMap)
    // =========================
    const selectedSubject = useMemo(() => {
        if (!selectedId) return null;
        const s = subjects.find((x) => x.id === selectedId);
        if (!s) return null;
        return { id: s.id, name: s.name, year: s.year };
    }, [selectedId, subjects]);

    const panelInitialStatus = useMemo<Status>(() => {
        if (!selectedId) return "pendiente";
        const s = subjects.find((x) => x.id === selectedId);
        if (!s) return "pendiente";

        const st = s.computedStatus;
        // Igual que antes: disponible/bloqueada => "pendiente"
        if (st === "disponible" || st === "bloqueada") return "pendiente";
        return (st ?? "pendiente") as Status;
    }, [selectedId, subjects]);

    const panelInitialGrade = useMemo<number | null>(() => {
        if (!selectedId) return null;
        const s = subjects.find((x) => x.id === selectedId);
        return s?.grade ?? null;
    }, [selectedId, subjects]);

    const panelInitialPassedVia = useMemo<PassedVia | null>(() => {
        if (!selectedId) return null;
        const s = subjects.find((x) => x.id === selectedId);
        return s?.passedVia ?? null;
    }, [selectedId, subjects]);

    return {
        // estados generales
        loading,
        error,
        refresh,

        // data
        subjects,
        years,
        subjectsByYear,

        // prereqs (por si lo necesitás en CareerMap para edges)
        prereqsRendir,
        prereqsBySubject,

        // selección
        selectedId,
        setSelectedId,
        clearSelection,

        // panel (compatibles con tu SubjectPanel)
        selectedSubject,
        panelInitialStatus,
        panelInitialGrade,
        panelInitialPassedVia,
    };
}