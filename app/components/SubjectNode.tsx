"use client";

import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

type Status =
    | "pendiente"
    | "cursando"
    | "final_pendiente"
    | "aprobada"
    | "disponible"
    | "bloqueada";

type Data = {
    kind?: "header" | "subject";
    title?: string;
    subtitle?: string;
    status?: Status;
    grade?: number | null;
    passedVia?: "promo" | "final" | null;
};

const handleStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: 999,
    opacity: 0,            // 👈 invisible
    background: "transparent",
    border: "none",
};

export default function SubjectNode(props: NodeProps<Data>) {
    const data = props.data ?? {};
    const title = data.title ?? "(sin título)";

    // Header (Año 1/2/3) - sin handles
    if (data.kind === "header") {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9CA3AF",
                    fontWeight: 700,
                    fontSize: 14,
                    userSelect: "none",
                    pointerEvents: "none",
                }}
            >
                {title}
            </div>
        );
    }

    const status = data.status ?? "pendiente";

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
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                padding: "10px 14px",
                gap: 6,
                userSelect: "none",
                fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
            }}
        >
            {/* ✅ Handles invisibles para que ReactFlow pueda enganchar edges */}
            <Handle
                type="target"
                position={Position.Top}
                id="in"
                isConnectable={false}
                style={handleStyle}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="out"
                isConnectable={false}
                style={handleStyle}
            />

            <div
                style={{
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    letterSpacing: 0.2,
                    textShadow: "0 1px 0 rgba(0,0,0,.35)",
                }}
            >
                {title}
            </div>

            {!!data.subtitle && (
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: subtitleColor,
                        lineHeight: 1,
                        letterSpacing: 0.15,
                        opacity: 0.95,
                    }}
                >
                    {data.subtitle}
                </div>
            )}

            {status === "aprobada" && typeof data.grade === "number" && (
                <div
                    style={{
                        position: "absolute",
                        top: 8,
                        right: 10,
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 7px",
                        borderRadius: 8,
                        background: "rgba(34,197,94,.9)",
                        color: "#041007",
                        boxShadow: "0 6px 18px rgba(34,197,94,.18)",
                    }}
                >
                    {data.grade.toFixed(2)}
                </div>
            )}
        </div>
    );
}