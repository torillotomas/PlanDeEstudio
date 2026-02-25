"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { NodeStatus } from "@/lib/career/computeSubjectStatus";

type Edge = { from: string; to: string };
type SubjectMeta = { id: string; computedStatus: NodeStatus };

function colorFor(status: NodeStatus) {
    if (status === "aprobada") return "rgba(34,197,94,.85)";
    if (status === "final_pendiente") return "rgba(234,179,8,.85)";
    if (status === "cursando") return "rgba(59,130,246,.85)";
    if (status === "disponible") return "rgba(148,163,184,.55)";
    return "rgba(148,163,184,.30)";
}

export default function PrereqEdgesLayer({
    edges,
    subjects,
    focusId,
    scrollContainerId,
}: {
    edges: Edge[];
    subjects: SubjectMeta[];
    focusId: string | null;
    scrollContainerId: string;
}) {
    const hostRef = useRef<HTMLDivElement | null>(null);

    const [paths, setPaths] = useState<
        {
            id: string;
            d: string;
            stroke: string;
            opacity: number;
            width: number;
            dasharray: string;
        }[]
    >([]);

    const subjectStatus = useMemo(() => {
        const m = new Map<string, NodeStatus>();
        for (const s of subjects) m.set(s.id, s.computedStatus);
        return m;
    }, [subjects]);

    useLayoutEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        const scroller = document.getElementById(scrollContainerId) as HTMLElement | null;
        if (!scroller) return;

        let raf = 0;

        const compute = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const hostRect = host.getBoundingClientRect();
                const next: typeof paths = [];

                for (const e of edges) {
                    const fromEl = document.querySelector<HTMLElement>(`[data-subject="${e.from}"]`);
                    const toEl = document.querySelector<HTMLElement>(`[data-subject="${e.to}"]`);
                    if (!fromEl || !toEl) continue;

                    const a = fromEl.getBoundingClientRect();
                    const b = toEl.getBoundingClientRect();

                    const x1 = a.left + a.width / 2 - hostRect.left;
                    const y1 = a.bottom - hostRect.top;

                    const x2 = b.left + b.width / 2 - hostRect.left;
                    const y2 = b.top - hostRect.top;

                    const dy = Math.max(40, Math.min(220, (y2 - y1) * 0.55));
                    const d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;

                    const st = subjectStatus.get(e.from) ?? "pendiente";
                    const stroke = colorFor(st);

                    const isFocusing = !!focusId;
                    const isConnected = !!focusId && (focusId === e.from || focusId === e.to);

                    const width = isFocusing ? (isConnected ? 2.3 : 1.0) : 1.15;
                    const opacity = isFocusing ? (isConnected ? 0.95 : 0.07) : 0.24;

                    // ✅ punteado suave (más dash cuando está enfocado)
                    const dasharray = isFocusing && isConnected ? "9 10" : "7 12";

                    next.push({
                        id: `${e.from}->${e.to}`,
                        d,
                        stroke,
                        opacity,
                        width,
                        dasharray,
                    });
                }

                setPaths(next);
            });
        };

        compute();

        const onScroll = () => compute();
        scroller.addEventListener("scroll", onScroll, { passive: true });

        window.addEventListener("resize", compute);

        const ro = new ResizeObserver(() => compute());
        ro.observe(host);

        return () => {
            cancelAnimationFrame(raf);
            scroller.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", compute);
            ro.disconnect();
        };
    }, [edges, focusId, subjectStatus, scrollContainerId]);

    return (
        <div
            ref={hostRef}
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 0,
            }}
        >
            {/* ✅ animación global del “flujo” */}
            <style>{`
        @keyframes dashflow {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -240; }
        }
      `}</style>

            <svg
                style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "visible",
                    pointerEvents: "none",
                }}
            >
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="white" />
                    </marker>
                </defs>

                {paths.map((p) => {
                    const isFast = p.opacity > 0.5; // conectado (en foco)
                    return (
                        <path
                            key={p.id}
                            d={p.d}
                            fill="none"
                            stroke={p.stroke}
                            strokeWidth={p.width}
                            strokeOpacity={p.opacity}
                            strokeDasharray={p.dasharray}
                            markerEnd="url(#arrow)"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                animation: `dashflow ${isFast ? 3.5 : 4.0}s linear infinite`,
                                filter: p.opacity > 0.5 ? `drop-shadow(0 0 5px ${p.stroke})` : "none",
                            }}
                        />
                    );
                })}
            </svg>
        </div>
    );
}