"use client";

import React from "react";
import type { NodeStatus } from "@/lib/career/computeSubjectStatus";

export default function SubjectCard({
    id,
    title,
    subtitle,
    status,
    grade,
    isSelected,
    onClick,
    onHoverStart,
    onHoverEnd,
}: {
    id: string;
    title: string;
    subtitle?: string;
    status: NodeStatus;
    grade?: number | null;
    isSelected?: boolean;
    onClick?: () => void;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
}) {
    // color subtitle según estado (igual que antes)
    const subtitleColor =
        status === "aprobada"
            ? "rgba(74,222,128,.95)"
            : status === "final_pendiente"
                ? "rgba(250,204,21,.95)"
                : status === "cursando" || status === "disponible"
                    ? "rgba(147,197,253,.95)"
                    : "rgba(156,163,175,.9)";

    return (
        <div
            data-subject={id}
            onClick={onClick}
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            style={{
                position: "relative",
                width: "100%",
                minHeight: 72, // ✅ más compacta
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.10)",
                background: "rgba(15,15,15,.92)",
                color: "#fff",
                cursor: "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "10px 14px",
                boxSizing: "border-box",
                transition: "box-shadow .12s ease, border-color .12s ease",
                fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
            }}
        >
            {/* CONTENIDO CENTRADO REAL */}
            <div
                style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center", // ✅ centrado horizontal real
                    justifyContent: "center",
                    gap: 4,
                    pointerEvents: "none",
                }}
            >
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 800,
                        lineHeight: 1.15,
                        letterSpacing: 0.2,
                        textAlign: "center", // ✅ texto centrado
                        maxWidth: "92%",
                    }}
                >
                    {title}
                </div>

                {!!subtitle && (
                    <div
                        style={{
                            fontSize: 11.5,
                            fontWeight: 650,
                            color: subtitleColor,
                            lineHeight: 1,
                            letterSpacing: 0.15,
                            opacity: 0.95,
                            textAlign: "center",
                        }}
                    >
                        {subtitle}
                    </div>
                )}
            </div>

            {/* BADGE NOTA */}
            {status === "aprobada" && typeof grade === "number" && (
                <div
                    style={{
                        position: "absolute",
                        top: 6,
                        right: 8,
                        fontSize: 10.5,
                        fontWeight: 900,
                        padding: "2px 6px",
                        borderRadius: 7,
                        background: "rgba(34,197,94,.9)",
                        color: "#041007",
                        boxShadow: "0 4px 12px rgba(34,197,94,.18)",
                        pointerEvents: "none",
                    }}
                >
                    {grade.toFixed(2)}
                </div>
            )}
        </div>
    );
}