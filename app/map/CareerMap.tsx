"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { type Edge, type Node, type ReactFlowInstance, MarkerType } from "reactflow";
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

// ✅ Más grande todo
const NODE_W = 330;
const NODE_H = 88;

const YEAR_GAP_Y = 80;
const YEAR_TOP_INNER = 70;
const COLS_PER_YEAR = 3;

const CELL_W = 390;
const CELL_H = 130;

const YEAR_LEFT_PAD = 200;
const TOP_PAD = 46;

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
            cursor: "default",
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
        transition: "box-shadow .12s ease, opacity .12s ease, border-color .12s ease",
        cursor: "default",
    };

    if (status === "aprobada") {
        return {
            ...base,
            border: "1px solid rgba(34,197,94,.65)",
            boxShadow: "0 0 0 1px rgba(34,197,94,.15), 0 10px 30px rgba(34,197,94,.08)",
        };
    }

    if (status === "final_pendiente") {
        return {
            ...base,
            border: "1px solid rgba(234,179,8,.65)",
            boxShadow: "0 0 0 1px rgba(234,179,8,.15), 0 10px 30px rgba(234,179,8,.08)",
        };
    }

    if (status === "cursando") {
        return {
            ...base,
            border: "1px solid rgba(59,130,246,.65)",
            boxShadow: "0 0 0 1px rgba(59,130,246,.15), 0 10px 30px rgba(59,130,246,.08)",
        };
    }

    if (status === "disponible") {
        return {
            ...base,
            border: "1px dashed rgba(59,130,246,.65)",
            boxShadow: "0 0 0 1px rgba(59,130,246,.10), 0 10px 30px rgba(59,130,246,.06)",
        };
    }

    // bloqueada / pendiente
    return { ...base, opacity: 0.65 };
}

export default function CareerMap() {
    const planId = "ea89a8b8-a467-47ad-8182-f4d773d650b0";

    // ✅ crudo
    const [rawNodes, setRawNodes] = useState<Node[]>([]);
    const [rawEdges, setRawEdges] = useState<Edge[]>([]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const hoverTimer = useRef<number | null>(null);

    // ✅ instancia sin useReactFlow()
    const rf = useRef<ReactFlowInstance | null>(null);

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

            // 2) Correlativas (rendir)
            const { data: prereqs, error: prereqErr } = await supabase
                .from("subject_prereq")
                .select("subject_id, prereq_subject_id, prereq_type");

            if (!alive) return;
            if (prereqErr) console.error("Error prereqs:", prereqErr);

            const pAll = (prereqs ?? []) as PrereqRow[];
            const p = pAll.filter((r) => String(r.prereq_type ?? "").trim().toLowerCase() === "rendir");

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

            const prereqsBySubject = new Map<string, string[]>();
            for (const r of p) {
                const arr = prereqsBySubject.get(r.subject_id) ?? [];
                arr.push(r.prereq_subject_id);
                prereqsBySubject.set(r.subject_id, arr);
            }

            const prereqInfo = (subjectId: string) => {
                const prereqIds = prereqsBySubject.get(subjectId) ?? [];
                const hasPrereqs = prereqIds.length > 0;
                const allApproved = prereqIds.every((pr) => (statusById.get(pr) ?? "pendiente") === "aprobada");
                return { hasPrereqs, allApproved, prereqIds };
            };

            // Layout
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

            // Headers
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

            // Subjects
            const subjectNodes: Node[] = s.map((subj) => {
                const stt = statusById.get(subj.id) ?? "pendiente";
                const { hasPrereqs, allApproved } = prereqInfo(subj.id);

                let computedStatus: NodeStatus;
                if (stt !== "pendiente") computedStatus = stt;
                else computedStatus = !hasPrereqs ? "disponible" : allApproved ? "disponible" : "bloqueada";

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
                        isFocus: false,
                        isNeighbor: false,
                    },
                    position: { x, y },
                    style: nodeStyleFor(computedStatus, false),
                };
            });

            setRawNodes([...headerNodes, ...subjectNodes]);

            // Edges (handles out/in)
            setRawEdges(
                p.map((r) => ({
                    id: `${r.prereq_subject_id}->${r.subject_id}`,
                    source: r.prereq_subject_id,
                    target: r.subject_id,
                    type: "bezier",
                    sourceHandle: "out",
                    targetHandle: "in",
                    data: { ok: (statusById.get(r.prereq_subject_id) ?? "pendiente") === "aprobada" },
                })) as Edge[]
            );
        })();

        return () => {
            alive = false;
        };
    }, [refreshKey]);

    // ✅ fitView cuando cambian nodos (carga inicial / refresh)
    useEffect(() => {
        const inst = rf.current;
        if (!inst) return;
        if (rawNodes.length === 0) return;

        const t = window.setTimeout(() => {
            inst.fitView({ padding: 0.18, includeHiddenNodes: true, duration: 280 });
        }, 60);

        return () => window.clearTimeout(t);
    }, [rawNodes.length, rawEdges.length]);

    // foco: seleccionado gana sobre hover
    const focusId = selectedId ?? hoveredNodeId;

    // nodos conectados al foco
    const connectedIds = useMemo(() => {
        const set = new Set<string>();
        if (!focusId) return set;
        set.add(focusId);

        for (const e of rawEdges) {
            if (e.source === focusId) set.add(String(e.target));
            if (e.target === focusId) set.add(String(e.source));
        }
        return set;
    }, [rawEdges, focusId]);

    // edges con highlight
    const styledEdges = useMemo(() => {
        const isFocusing = !!focusId;

        return rawEdges.map((e) => {
            const ok = Boolean((e.data as any)?.ok);
            const isConnected = focusId != null && (e.source === focusId || e.target === focusId);

            const baseStroke = ok ? "rgba(34,197,94,.32)" : "rgba(148,163,184,.20)";
            const baseWidth = ok ? 1.6 : 1.3;

            const dimStroke = ok ? "rgba(34,197,94,.12)" : "rgba(148,163,184,.08)";
            const dimWidth = ok ? 1.1 : 1.0;

            const hiStroke = ok ? "rgba(34,197,94,.92)" : "rgba(226,232,240,.82)";
            const hiWidth = ok ? 3.0 : 2.6;

            const stroke = isFocusing ? (isConnected ? hiStroke : dimStroke) : baseStroke;
            const strokeWidth = isFocusing ? (isConnected ? hiWidth : dimWidth) : baseWidth;

            const markerSize = isConnected ? 10 : 9;

            return {
                ...e,
                animated: Boolean(isConnected),
                style: {
                    stroke,
                    strokeWidth,
                    strokeDasharray: ok ? undefined : "5 6",
                    opacity: isFocusing ? (isConnected ? 1 : 0.12) : 0.30,
                    filter: isConnected ? `drop-shadow(0 0 6px ${stroke}) drop-shadow(0 0 14px ${stroke})` : "none",
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: markerSize,
                    height: markerSize,
                    color: stroke,
                },
            } as Edge;
        });
    }, [rawEdges, focusId]);

    // nodes: glow/opacity + flags (sin outline feo)
    const styledNodes = useMemo(() => {
        const isFocusing = !!focusId;

        return rawNodes.map((n) => {
            const kind = (n.data as any)?.kind;
            if (kind === "header") return n;

            const isFocus = focusId != null && n.id === focusId;
            const isNeighbor = focusId != null && connectedIds.has(n.id) && !isFocus;
            const isDim = isFocusing && !connectedIds.has(n.id);

            const baseStyle = (n.style ?? {}) as React.CSSProperties;

            return {
                ...n,
                data: {
                    ...(n.data as any),
                    isFocus,
                    isNeighbor,
                },
                style: {
                    ...baseStyle,
                    opacity: isDim ? 0.35 : 1,
                    boxShadow: isFocus
                        ? `${baseStyle.boxShadow ?? ""}, 0 0 0 2px rgba(255,255,255,.10), 0 20px 60px rgba(0,0,0,.55)`
                        : isNeighbor
                            ? `${baseStyle.boxShadow ?? ""}, 0 0 0 1px rgba(255,255,255,.08), 0 16px 45px rgba(0,0,0,.45)`
                            : (baseStyle.boxShadow as any),
                },
            } as Node;
        });
    }, [rawNodes, focusId, connectedIds]);

    // Panel derivado
    const selectedNode = useMemo(() => {
        if (!selectedId) return null;
        return rawNodes.find((n) => n.id === selectedId) ?? null;
    }, [selectedId, rawNodes]);

    const selectedSubject = useMemo(() => {
        if (!selectedNode) return null;
        const d: any = selectedNode.data ?? {};
        return { id: selectedNode.id, name: d.title ?? "", year: Number(d.year ?? 0) };
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
        <div
            style={{
                height: "100%",
                display: "grid",
                gridTemplateColumns: selectedId ? "1fr 420px" : "1fr 0px",
                transition: "grid-template-columns 220ms ease",
                overflow: "hidden",
            }}
        >
            {/* MAPA */}
            <div style={{ minWidth: 0, height: "100%" }}>
                <ReactFlow
                    onInit={(inst) => {
                        rf.current = inst;
                    }}
                    nodes={styledNodes}
                    edges={styledEdges}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={{
                        type: "bezier",
                        markerEnd: { type: MarkerType.ArrowClosed, width: 9, height: 9, color: "rgba(148,163,184,.25)" },
                        style: { stroke: "rgba(148,163,184,.16)", strokeWidth: 1.2, opacity: 0.32 },
                    }}
                    // ✅ Ruedita = pan | Ctrl+ruedita = zoom (lo maneja ReactFlow)
                    panOnDrag={false}
                    panOnScroll
                    zoomOnScroll
                    zoomOnPinch
                    preventScrolling={false}
                    // ✅ cursor normal
                    style={{ cursor: "default" }}
                    minZoom={0.6}
                    maxZoom={1.65}
                    fitView
                    fitViewOptions={{ padding: 0.18, includeHiddenNodes: true }}
                    proOptions={{ hideAttribution: true }}
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

            {/* PANEL (en layout, no encima) */}
            <aside
                style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    borderLeft: selectedId ? "1px solid rgba(255,255,255,.08)" : "1px solid transparent",
                    background: "rgba(0,0,0,.35)",
                    backdropFilter: "blur(10px)",
                    transform: selectedId ? "translateX(0)" : "translateX(16px)",
                    opacity: selectedId ? 1 : 0,
                    pointerEvents: selectedId ? "auto" : "none",
                    transition: "transform 220ms ease, opacity 220ms ease",
                }}
            >
                <SubjectPanel
                    open={!!selectedId}
                    onClose={() => setSelectedId(null)}
                    subject={selectedSubject}
                    initialStatus={panelInitialStatus}
                    initialGrade={panelInitialGrade}
                    initialPassedVia={panelInitialPassedVia}
                    onSaved={() => setRefreshKey((k) => k + 1)}
                />
            </aside>
        </div>
    );
}