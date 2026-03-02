"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import SubjectPanel from "./SubjectPanel";
import SubjectCard from "./SubjectCard";
import PrereqEdgesLayer from "./PrereqEdgesLayer";
import { useCareerData } from "@/lib/career/useCareerData";
import type { NodeStatus } from "@/lib/career/computeSubjectStatus";
import { useMyPlan } from "@/lib/career/useMyPlan";
import { useRouter } from "next/navigation";

export default function CareerTimeline() {
    // 1) Plan actual del usuario
    const { loading: planLoading, error: planError, planId, plan } = useMyPlan();
    const router = useRouter();
    // 2) Data académica (acepta string | null)
    const {
        loading,
        error,
        years,
        subjectsByYear,
        subjects,
        prereqsRendir,
        selectedId,
        setSelectedId,
        clearSelection,
        selectedSubject,
        panelInitialStatus,
        panelInitialGrade,
        panelInitialPassedVia,
        refresh,
    } = useCareerData(planId);

    // hover (con delay)
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const hoverTimer = useRef<number | null>(null);

    // foco: selected > hover
    const focusId = selectedId ?? hoveredId;

    // edges base
    const edges = useMemo(() => {
        return prereqsRendir.map((r) => ({
            from: r.prereq_subject_id,
            to: r.subject_id,
        }));
    }, [prereqsRendir]);

    // ids conectados al foco
    const connectedIds = useMemo(() => {
        const set = new Set<string>();
        if (!focusId) return set;
        set.add(focusId);
        for (const e of edges) {
            if (e.from === focusId) set.add(e.to);
            if (e.to === focusId) set.add(e.from);
        }
        return set;
    }, [edges, focusId]);

    // meta para SVG
    const subjectsMeta = useMemo(() => {
        return subjects.map((s) => ({
            id: s.id,
            computedStatus: s.computedStatus as NodeStatus,
        }));
    }, [subjects]);

    // remount edges al cambiar layout
    const [edgesVersion, setEdgesVersion] = useState(0);
    useEffect(() => {
        const t = window.setTimeout(() => setEdgesVersion((v) => v + 1), 30);
        return () => window.clearTimeout(t);
    }, [selectedId, years.length, subjects.length]);

    const hasPanel = !!selectedId;

    // ✅ Estado superior (plan loading/error/no plan) SIN returns tempranos
    const topState = useMemo(() => {
        if (planLoading) {
            return (
                <div style={{ padding: 18, color: "rgba(156,163,175,.95)", fontSize: 13 }}>
                    Cargando plan…
                </div>
            );
        }

        if (planError) {
            return (
                <div
                    style={{
                        padding: 14,
                        margin: 18,
                        borderRadius: 12,
                        background: "rgba(239,68,68,.12)",
                        border: "1px solid rgba(239,68,68,.25)",
                        color: "rgba(254,202,202,.95)",
                        fontSize: 12,
                    }}
                >
                    {planError}
                </div>
            );
        }

        if (!planId) {
            return (
                <div style={{ padding: 18 }}>
                    <div style={{ color: "rgba(229,231,235,.92)", fontWeight: 900 }}>
                        No tenés una carrera creada.
                    </div>
                    <div style={{ marginTop: 8, color: "rgba(156,163,175,.95)", fontSize: 12 }}>
                        Andá a “Crear carrera” y después cargamos materias.
                    </div>
                </div>
            );
        }

        return null;
    }, [planLoading, planError, planId]);

    // ✅ Content SIEMPRE definido (aunque esté en loading/no plan)
    const content = useMemo(() => {
        // Si hay topState (cargando plan/error/no plan), mostramos eso.
        if (topState) return topState;

        if (loading) {
            return (
                <div style={{ padding: 18, color: "rgba(156,163,175,.95)", fontSize: 13 }}>
                    Cargando materias…
                </div>
            );
        }

        if (error) {
            return (
                <div
                    style={{
                        padding: 14,
                        margin: 18,
                        borderRadius: 12,
                        background: "rgba(239,68,68,.12)",
                        border: "1px solid rgba(239,68,68,.25)",
                        color: "rgba(254,202,202,.95)",
                        fontSize: 12,
                    }}
                >
                    {error}
                </div>
            );
        }

        // Empty state: plan existe pero no hay materias
        if (subjects.length === 0) {
            return (
                <div style={{ padding: 18 }}>
                    <div style={{ fontSize: 14, fontWeight: 950, color: "#fff" }}>
                        {plan?.name ?? "Tu carrera"}
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: "rgba(156,163,175,.95)" }}>
                        Todavía no cargaste materias.
                    </div>

                    <button
                        onClick={() => router.push("/subjects")}
                        style={{
                            marginTop: 14,
                            border: "1px solid rgba(59,130,246,.45)",
                            background: "rgba(59,130,246,.18)",
                            color: "#fff",
                            borderRadius: 12,
                            padding: "10px 14px",
                            cursor: "pointer",
                            fontWeight: 900,
                            fontSize: 12,
                        }}
                    >
                        Ir a Materias
                    </button>
                </div>
            );
        }

        return (
            <div
                style={{
                    padding: 22,
                    paddingRight: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 34,
                }}
            >
                {years.map((year) => {
                    const list = subjectsByYear.get(year) ?? [];

                    return (
                        <section key={year} style={{ marginBottom: 0 }}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    marginBottom: 14,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 900,
                                        letterSpacing: 0.4,
                                        color: "rgba(209,213,219,.85)",
                                    }}
                                >
                                    Año {year}
                                </div>

                                <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>
                                    {list.length} materias
                                </div>
                            </div>

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                                    gap: 22,
                                    rowGap: 24,
                                }}
                            >
                                {list.map((s) => {
                                    const isSelected = selectedId === s.id;
                                    const isFocusing = !!focusId;
                                    const isConnected = focusId ? connectedIds.has(s.id) : false;
                                    const isDim = isFocusing && !isConnected;

                                    return (
                                        <div
                                            key={s.id}
                                            style={{
                                                opacity: isDim ? 0.32 : 1,
                                                transition: "opacity .12s ease",
                                            }}
                                        >
                                            <SubjectCard
                                                id={s.id}
                                                title={s.name}
                                                subtitle={s.subtitle}
                                                status={s.computedStatus}
                                                grade={s.grade}
                                                isSelected={isSelected}
                                                onClick={() => setSelectedId(s.id)}
                                                onHoverStart={() => {
                                                    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                                                    setHoveredId(s.id);
                                                }}
                                                onHoverEnd={() => {
                                                    hoverTimer.current = window.setTimeout(() => setHoveredId(null), 80);
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>
        );
    }, [
        topState,
        loading,
        error,
        subjects.length,
        years,
        subjectsByYear,
        selectedId,
        setSelectedId,
        focusId,
        connectedIds,
        plan?.name,
    ]);

    return (
        <div
            style={{
                height: "100%",
                display: "grid",
                gridTemplateColumns: hasPanel ? "1fr 420px" : "1fr 0px",
                transition: "grid-template-columns 220ms ease",
                overflow: "hidden",
            }}
        >
            {/* CONTENIDO + FLECHAS */}
            <div
                style={{
                    minWidth: 0,
                    height: "100%",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <PrereqEdgesLayer
                    key={edgesVersion}
                    edges={edges}
                    subjects={subjectsMeta}
                    focusId={focusId}
                    scrollContainerId="timeline-scroll"
                />

                <div
                    id="timeline-scroll"
                    style={{
                        height: "100%",
                        overflowY: "auto",
                        overflowX: "hidden",
                        position: "relative",
                        zIndex: 1,
                    }}
                    onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target?.closest?.("[data-subject]")) return;
                        clearSelection();
                    }}
                >
                    {content}
                </div>
            </div>

            {/* PANEL */}
            <aside
                style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    borderLeft: hasPanel ? "1px solid rgba(255,255,255,.08)" : "1px solid transparent",
                    background: "rgba(0,0,0,.35)",
                    backdropFilter: "blur(10px)",
                    transform: hasPanel ? "translateX(0)" : "translateX(16px)",
                    opacity: hasPanel ? 1 : 0,
                    pointerEvents: hasPanel ? "auto" : "none",
                    transition: "transform 220ms ease, opacity 220ms ease",
                }}
            >
                <SubjectPanel
                    open={!!selectedId}
                    onClose={clearSelection}
                    subject={selectedSubject}
                    initialStatus={panelInitialStatus}
                    initialGrade={panelInitialGrade}
                    initialPassedVia={panelInitialPassedVia}
                    onSaved={refresh}
                />
            </aside>
        </div>
    );
}