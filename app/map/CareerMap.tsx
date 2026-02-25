"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import ReactFlow, { type Edge, type Node, MarkerType } from "reactflow";
import "reactflow/dist/style.css";

import SubjectNode from "@/app/components/SubjectNode";
import { supabase } from "@/lib/supabaseClient";
import SubjectPanel from "./SubjectPanel";

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

type Status = "pendiente" | "cursando" | "final_pendiente" | "aprobada";
type NodeStatus = Status | "disponible" | "bloqueada";

type StatusRow = {
    subject_id: string;
    status: Status;
    grade: number | null;
    passed_via: "promo" | "final" | null;
};

const NODE_W = 300;
const NODE_H = 78;

// ✅ Layout horizontal (años en filas)
const YEAR_GAP_Y = 70;
const YEAR_TOP_INNER = 60;
const COLS_PER_YEAR = 3;

const CELL_W = 340;
const CELL_H = 110;

const YEAR_LEFT_PAD = 180;
const TOP_PAD = 40;

function nodeStyleFor(status: NodeStatus, isHeader = false): React.CSSProperties {
    if (isHeader) {
        return {
            width: YEAR_LEFT_PAD,
            height: 40,
            background: "transparent",
            border: "1px solid transparent",
            boxSizing: "border-box",
            userSelect: "none",
            pointerEvents: "none",
        };
    }

    const base: React.CSSProperties = {
        width: NODE_W,
        height: NODE_H,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(15,15,15,.92)",
        color: "#fff",
        boxSizing: "border-box",
        transition:
            "box-shadow .12s ease, transform .12s ease, opacity .12s ease, border-color .12s ease",
    };

    if (status === "aprobada") {
        return {
            ...base,
            border: "1px solid rgba(34,197,94,.65)",
            boxShadow:
                "0 0 0 1px rgba(34,197,94,.15), 0 10px 30px rgba(34,197,94,.08)",
        };
    }

    if (status === "final_pendiente") {
        return {
            ...base,
            border: "1px solid rgba(234,179,8,.65)",
            boxShadow:
                "0 0 0 1px rgba(234,179,8,.15), 0 10px 30px rgba(234,179,8,.08)",
        };
    }

    if (status === "cursando") {
        return {
            ...base,
            border: "1px solid rgba(59,130,246,.65)",
            boxShadow:
                "0 0 0 1px rgba(59,130,246,.15), 0 10px 30px rgba(59,130,246,.08)",
        };
    }

    if (status === "disponible") {
        return {
            ...base,
            border: "1px dashed rgba(59,130,246,.65)",
            boxShadow:
                "0 0 0 1px rgba(59,130,246,.10), 0 10px 30px rgba(59,130,246,.06)",
        };
    }

    // bloqueada
    return { ...base, opacity: 0.65 };
}

export default function CareerMap() {
    const planId = "ea89a8b8-a467-47ad-8182-f4d773d650b0";

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // ✅ Hover para resaltar flechas
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const hoverTimer = useRef<number | null>(null);

    const nodeTypes = useMemo(
        () => ({
            subject: SubjectNode,
            header: SubjectNode,
        }),
        []
    );

    useEffect(() => {
        let alive = true;

        (async () => {
            // 1) Materias
            const { data: subjects, error } = await supabase
                .from("subjects")
                .select("id,name,year,period_key,order_in_cell")
                .eq("plan_id", planId)
                .order("year", { ascending: true })
                .order("order_in_cell", { ascending: true });

            if (!alive) return;
            if (error) return void console.error("Error subjects:", error);

            const s = (subjects ?? []) as SubjectRow[];
            const years = Array.from(new Set(s.map((x) => x.year))).sort((a, b) => a - b);

            // 2) Correlativas (traemos todas y filtramos nosotros)
            const { data: prereqs, error: prereqErr } = await supabase
                .from("subject_prereq")
                .select("subject_id, prereq_subject_id, prereq_type");

            if (!alive) return;
            if (prereqErr) console.error("Error prereqs:", prereqErr);

            const pAll = (prereqs ?? []) as PrereqRow[];
            const p = pAll.filter(
                (r) => String(r.prereq_type ?? "").trim().toLowerCase() === "rendir"
            );

            // 3) Estados
            const { data: statuses, error: statusErr } = await supabase
                .from("user_subject_status")
                .select("subject_id,status,grade,passed_via");

            if (!alive) return;
            if (statusErr) console.error("Error statuses:", statusErr);

            const st = (statuses ?? []) as StatusRow[];

            const statusById = new Map<string, Status>();
            const gradeById = new Map<string, number | null>();
            const passedById = new Map<string, "promo" | "final" | null>();

            for (const row of st) {
                statusById.set(row.subject_id, row.status);
                gradeById.set(row.subject_id, row.grade ?? null);
                passedById.set(row.subject_id, row.passed_via ?? null);
            }

            // prereqsBySubject: materia -> correlativas "rendir"
            const prereqsBySubject = new Map<string, string[]>();
            for (const r of p) {
                const arr = prereqsBySubject.get(r.subject_id) ?? [];
                arr.push(r.prereq_subject_id);
                prereqsBySubject.set(r.subject_id, arr);
            }

            // ✅ cumple para rendir si TODAS las correlativas están APROBADAS
            const prereqInfo = (subjectId: string) => {
                const prereqIds = prereqsBySubject.get(subjectId) ?? [];
                const hasPrereqs = prereqIds.length > 0;

                const allApproved = prereqIds.every(
                    (pr) => (statusById.get(pr) ?? "pendiente") === "aprobada"
                );

                return { hasPrereqs, allApproved, prereqIds };
            };

            // Layout dinámico (años no se pisan)
            const subjectsByYear = new Map<number, SubjectRow[]>();
            for (const subj of s) {
                const arr = subjectsByYear.get(subj.year) ?? [];
                arr.push(subj);
                subjectsByYear.set(subj.year, arr);
            }

            const yearY = new Map<number, number>();
            let cursorY = TOP_PAD;

            for (const year of years) {
                yearY.set(year, cursorY);

                const count = (subjectsByYear.get(year) ?? []).length;
                const rowsNeeded = Math.max(1, Math.ceil(count / COLS_PER_YEAR));

                const blockHeight = YEAR_TOP_INNER + rowsNeeded * CELL_H + YEAR_GAP_Y;
                cursorY += blockHeight;
            }

            // Headers (izquierda)
            const headerNodes: Node[] = years.map((year) => {
                const y0 = yearY.get(year) ?? TOP_PAD;

                return {
                    id: `header-year-${year}`,
                    type: "header",
                    data: { kind: "header", title: `Año ${year}` },
                    position: { x: 0, y: y0 },
                    draggable: false,
                    selectable: false,
                    focusable: false,
                    connectable: false,
                    style: {
                        ...nodeStyleFor("pendiente", true),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        paddingLeft: 18,
                        color: "rgba(209,213,219,.85)",
                        fontWeight: 800,
                        fontSize: 13,
                        letterSpacing: 0.4,
                    },
                };
            });

            // Materias
            const subjectNodes: Node[] = s.map((subj) => {
                const stt = statusById.get(subj.id) ?? "pendiente";
                const { hasPrereqs, allApproved } = prereqInfo(subj.id);

                // estado calculado usando SOLO rendir
                let computedStatus: NodeStatus;
                if (stt !== "pendiente") {
                    computedStatus = stt;
                } else {
                    computedStatus = !hasPrereqs ? "disponible" : allApproved ? "disponible" : "bloqueada";
                }

                const grade = gradeById.get(subj.id);
                const passed = passedById.get(subj.id);

                const subtitle =
                    computedStatus === "aprobada" && grade != null
                        ? `${grade.toFixed(2)} • ${passed === "promo" ? "Promo" : "Final"}`
                        : computedStatus === "final_pendiente"
                            ? "Final pendiente"
                            : computedStatus === "cursando"
                                ? "Cursando"
                                : computedStatus === "disponible" && hasPrereqs
                                    ? "Puedo rendir"
                                    : "";

                // grid dentro del año
                const idx = (subj.order_in_cell ?? 1) - 1;
                const colIndex = idx % COLS_PER_YEAR;
                const rowIndex = Math.floor(idx / COLS_PER_YEAR);

                const y0 = yearY.get(subj.year) ?? TOP_PAD;

                const x = YEAR_LEFT_PAD + colIndex * CELL_W;
                const y = y0 + YEAR_TOP_INNER + rowIndex * CELL_H;

                return {
                    id: subj.id,
                    type: "subject",
                    data: {
                        kind: "subject",
                        title: subj.name,
                        year: subj.year,
                        subtitle: subtitle || undefined,
                        status: computedStatus,
                        grade: grade ?? null,
                        passedVia: passed ?? null,
                    },
                    position: { x, y },
                    style: nodeStyleFor(computedStatus, false),
                };
            });

            setNodes([...headerNodes, ...subjectNodes]);

            setEdges(
                p.map((r) => ({
                    id: `${r.prereq_subject_id}->${r.subject_id}`,
                    source: r.prereq_subject_id,
                    target: r.subject_id,

                    // ✅ engancha a tus handles
                    sourceHandle: "out",
                    targetHandle: "in",

                    type: "bezier",
                    pathOptions: { curvature: 0.35 } as any,
                    animated: false,
                    data: {
                        ok: (statusById.get(r.prereq_subject_id) ?? "pendiente") === "aprobada",
                    },
                })) as Edge[]
            );
        })();

        return () => {
            alive = false;
        };
    }, [refreshKey]);

    const styledEdges = useMemo(() => {
        // ✅ prioridad: hover > selected
        const activeNodeId = hoveredNodeId ?? selectedId;
        const isActiveAny = activeNodeId != null;

        return edges.map((e) => {
            const ok = Boolean((e.data as any)?.ok);
            const isConnected =
                activeNodeId != null && (e.source === activeNodeId || e.target === activeNodeId);

            // Base (apagado)
            const baseStroke = ok ? "rgba(34,197,94,.35)" : "rgba(148,163,184,.22)";
            const baseWidth = ok ? 1.4 : 1.2;

            // Más apagado cuando hay un nodo activo pero esta arista no conecta
            const dimStroke = ok ? "rgba(34,197,94,.14)" : "rgba(148,163,184,.08)";
            const dimWidth = ok ? 1.05 : 1.0;

            // Highlight
            const hiStroke = ok ? "rgba(34,197,94,.90)" : "rgba(226,232,240,.80)";
            const hiWidth = ok ? 2.2 : 2.0;

            const stroke = isActiveAny ? (isConnected ? hiStroke : dimStroke) : baseStroke;
            const strokeWidth = isActiveAny ? (isConnected ? hiWidth : dimWidth) : baseWidth;

            // punta más chica (para que no quede gigante al resaltar)
            const markerColor = stroke;

            return {
                ...e,
                type: "bezier",
                animated: Boolean(isConnected),
                style: {
                    stroke,
                    strokeWidth,
                    strokeDasharray: ok ? undefined : "5 6",
                    opacity: isActiveAny ? (isConnected ? 1 : 0.18) : 0.38,
                    filter: isConnected
                        ? `drop-shadow(0 0 6px ${stroke}) drop-shadow(0 0 14px ${stroke})`
                        : "none",
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: isConnected ? 12 : 10,
                    height: isConnected ? 12 : 10,
                    color: markerColor,
                },
            } as Edge;
        });
    }, [edges, hoveredNodeId, selectedId]);

    // ✅ data derivada para el panel
    const selectedNode = useMemo(() => {
        if (!selectedId) return null;
        return nodes.find((n) => n.id === selectedId) ?? null;
    }, [selectedId, nodes]);

    const selectedSubject = useMemo(() => {
        if (!selectedNode) return null;
        const d: any = selectedNode.data ?? {};
        return {
            id: selectedNode.id,
            name: d.title ?? "",
            year: Number(d.year ?? 0),
        };
    }, [selectedNode]);

    const panelInitialStatus = useMemo(() => {
        if (!selectedNode) return "pendiente";
        const d: any = selectedNode.data ?? {};
        const st = d.status as any;
        if (st === "disponible" || st === "bloqueada") return "pendiente";
        return (st ?? "pendiente") as Status;
    }, [selectedNode]);

    const panelInitialGrade = useMemo(() => {
        if (!selectedNode) return null;
        const d: any = selectedNode.data ?? {};
        return (d.grade ?? null) as number | null;
    }, [selectedNode]);

    const panelInitialPassedVia = useMemo(() => {
        if (!selectedNode) return null;
        const d: any = selectedNode.data ?? {};
        return (d.passedVia ?? null) as "promo" | "final" | null;
    }, [selectedNode]);

    return (
        <>
            <div style={{ width: "100%", height: "100vh" }}>
                <ReactFlow
                    nodes={nodes}
                    edges={styledEdges}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={{
                        type: "bezier",
                        markerEnd: {
                            type: MarkerType.ArrowClosed,
                            width: 16,
                            height: 16,
                            color: "rgba(148,163,184,.30)",
                        },
                        style: {
                            stroke: "rgba(148,163,184,.18)",
                            strokeWidth: 1.2,
                            opacity: 0.35,
                        },
                    }}
                    fitView
                    fitViewOptions={{ padding: 0.15, includeHiddenNodes: true }}
                    minZoom={0.65}
                    maxZoom={1.6}
                    defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    proOptions={{ hideAttribution: true }}

                    // ✅ Scroll = mover el mapa (ruedita / trackpad)
                    panOnScroll

                    // ✅ No mover arrastrando
                    panOnDrag={false}

                    // ✅ Evitamos que la ruedita haga zoom
                    zoomOnScroll={false}

                    // ✅ Zoom con pinch (trackpad)
                    zoomOnPinch

                    // ✅ Opcional: sin zoom por doble click
                    zoomOnDoubleClick={false}

                    onNodeClick={(_, node) => {
                        const kind = (node.data as any)?.kind;
                        if (kind === "subject") setSelectedId(node.id);
                    }}
                    onPaneClick={() => setSelectedId(null)}
                    onNodeMouseEnter={(_, node) => {
                        const kind = (node.data as any)?.kind;
                        if (kind !== "subject") return;
                        if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                        setHoveredNodeId(node.id);
                    }}
                    onNodeMouseLeave={() => {
                        hoverTimer.current = window.setTimeout(() => setHoveredNodeId(null), 80);
                    }}
                />
            </div>

            <SubjectPanel
                open={!!selectedId}
                onClose={() => setSelectedId(null)}
                subject={selectedSubject}
                initialStatus={panelInitialStatus}
                initialGrade={panelInitialGrade}
                initialPassedVia={panelInitialPassedVia}
                onSaved={() => setRefreshKey((k) => k + 1)}
            />
        </>
    );
}