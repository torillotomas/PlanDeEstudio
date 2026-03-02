"use client";

import React, { useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

type Status = "pendiente" | "cursando" | "final_pendiente" | "aprobada";
type PassedVia = "promo" | "final";

type FileType = "apunte" | "tp" | "otro";

type FileRow = {
    id: string;
    user_id: string;
    subject_id: string;
    title: string;
    file_type: FileType;
    storage_path: string;
    created_at: string;
};

const BUCKET = "planmaterias-files";

export default function SubjectPanel({
    open,
    onClose,
    subject,
    initialStatus,
    initialGrade,
    initialPassedVia,
    onSaved,
}: {
    open: boolean;
    onClose: () => void;
    subject: { id: string; name: string; year: number } | null;
    initialStatus: Status;
    initialGrade: number | null;
    initialPassedVia: PassedVia | null;
    onSaved: () => void;
}) {
    // =========================
    // Estado académico
    // =========================
    const [status, setStatus] = useState<Status>(initialStatus);
    const [grade, setGrade] = useState<string>(initialGrade != null ? String(initialGrade) : "");
    const [passedVia, setPassedVia] = useState<PassedVia | "">(initialPassedVia ?? "");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string>("");

    // =========================
    // Mini-repo (por usuario)
    // =========================
    const [files, setFiles] = useState<FileRow[]>([]);
    const [filesLoading, setFilesLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [repoErr, setRepoErr] = useState<string>("");
    const [fileType, setFileType] = useState<FileType>("apunte");

    // UI helpers
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [pickedLabel, setPickedLabel] = useState<string>("Ningún archivo seleccionado");

    React.useEffect(() => {
        setStatus(initialStatus);
        setGrade(initialGrade != null ? String(initialGrade) : "");
        setPassedVia(initialPassedVia ?? "");
        setErr("");
    }, [subject?.id, initialStatus, initialGrade, initialPassedVia]);

    React.useEffect(() => {
        if (!open || !subject) return;
        void refreshFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, subject?.id]);

    const getUidOrThrow = async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        const uid = data?.user?.id;
        if (!uid) throw new Error("No hay usuario autenticado");
        return uid;
    };

    const refreshFiles = async () => {
        if (!subject) return;
        setFilesLoading(true);
        setRepoErr("");

        try {
            const uid = await getUidOrThrow();

            const { data, error } = await supabase
                .from("subject_files")
                .select("id,user_id,subject_id,title,file_type,storage_path,created_at")
                .eq("subject_id", subject.id)
                .eq("user_id", uid)
                .order("created_at", { ascending: false });

            if (error) throw error;

            setFiles((data ?? []) as FileRow[]);
        } catch (e: any) {
            setRepoErr(e?.message ?? "Error cargando archivos");
        } finally {
            setFilesLoading(false);
        }
    };

    const parsedGrade = useMemo(() => {
        if (status !== "aprobada") return null;
        if (grade.trim() === "") return null;
        const n = Number(grade);
        if (Number.isNaN(n)) return NaN;
        return n;
    }, [grade, status]);

    const isValidGrade = useMemo(() => {
        if (status !== "aprobada") return true;
        if (parsedGrade === null) return false;
        if (Number.isNaN(parsedGrade)) return false;

        if (parsedGrade < 1 || parsedGrade > 10) return false;
        const quarters = Math.round(parsedGrade * 4);
        return Math.abs(quarters / 4 - parsedGrade) < 1e-9;
    }, [parsedGrade, status]);

    const canSave = useMemo(() => {
        if (!subject) return false;
        if (status === "aprobada") return isValidGrade && passedVia !== "";
        return true;
    }, [subject, status, isValidGrade, passedVia]);

    // =========================
    // ✅ GUARDAR ESTADO (por usuario)
    // =========================
    const saveStatus = async () => {
        if (!subject) return;
        setSaving(true);
        setErr("");

        try {
            const uid = await getUidOrThrow();

            if (status === "pendiente") {
                // ✅ borrar SOLO el estado de este usuario
                const { error } = await supabase
                    .from("user_subject_status")
                    .delete()
                    .eq("user_id", uid)
                    .eq("subject_id", subject.id);

                if (error) throw error;
            } else {
                const payload: any = {
                    user_id: uid, // ✅ clave multiusuario
                    subject_id: subject.id,
                    status,
                    grade: null,
                    passed_via: null,
                    approved_at: null,
                    updated_at: new Date().toISOString(),
                };

                if (status === "aprobada") {
                    payload.grade = parsedGrade;
                    payload.passed_via = passedVia;
                    payload.approved_at = new Date().toISOString();
                }

                // ✅ upsert por (user_id, subject_id)
                const { error } = await supabase
                    .from("user_subject_status")
                    .upsert(payload, { onConflict: "user_id,subject_id" });

                if (error) throw error;
            }

            onSaved();
        } catch (e: any) {
            setErr(e?.message ?? "Error guardando");
        } finally {
            setSaving(false);
        }
    };

    // =========================
    // Upload / Download / Delete (por usuario)
    // =========================
    const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files;
        if (!picked || picked.length === 0 || !subject) return;

        const pickedArr = Array.from(picked);
        setPickedLabel(pickedArr.length === 1 ? pickedArr[0].name : `${pickedArr.length} archivos seleccionados`);

        setUploading(true);
        setRepoErr("");

        try {
            const uid = await getUidOrThrow();

            for (const file of pickedArr) {
                const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
                const stamp = new Date().toISOString().replace(/[:.]/g, "-");

                const storagePath = `${uid}/${subject.id}/${stamp}-${safeName}`;

                const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
                    upsert: false,
                    contentType: file.type || undefined,
                });
                if (upErr) throw upErr;

                const { error: insErr } = await supabase.from("subject_files").insert({
                    user_id: uid,
                    subject_id: subject.id,
                    title: file.name,
                    file_type: fileType,
                    storage_path: storagePath,
                });
                if (insErr) throw insErr;
            }

            await refreshFiles();
        } catch (e2: any) {
            setRepoErr(e2?.message ?? "Error subiendo archivos");
        } finally {
            setUploading(false);
            e.target.value = "";
            setPickedLabel("Ningún archivo seleccionado");
        }
    };

    const downloadFile = async (f: FileRow) => {
        setRepoErr("");
        try {
            const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 60);
            if (error) throw error;
            if (!data?.signedUrl) throw new Error("No se pudo generar el link");
            window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        } catch (e: any) {
            setRepoErr(e?.message ?? "Error descargando");
        }
    };

    const deleteFile = async (f: FileRow) => {
        if (!confirm(`¿Borrar "${f.title}"?`)) return;

        setRepoErr("");
        try {
            const { error: rmErr } = await supabase.storage.from(BUCKET).remove([f.storage_path]);
            if (rmErr) throw rmErr;

            const { error: delErr } = await supabase.from("subject_files").delete().eq("id", f.id);
            if (delErr) throw delErr;

            await refreshFiles();
        } catch (e: any) {
            setRepoErr(e?.message ?? "Error borrando");
        }
    };

    // UI styles for select wrapper + arrow
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

    if (!open) return null;

    return (
        <div
            style={{
                height: "100%",
                width: "100%",
                background: "rgba(10,10,10,.96)",
                borderLeft: "1px solid rgba(255,255,255,.10)",
                padding: 16,
                color: "#fff",
                backdropFilter: "blur(6px)",
                overflowY: "auto",
            }}
        >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>{subject ? `Año ${subject.year}` : ""}</div>
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 900,
                            lineHeight: 1.1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                        title={subject?.name ?? ""}
                    >
                        {subject?.name ?? ""}
                    </div>
                </div>

                <button
                    onClick={onClose}
                    style={{
                        height: 34,
                        width: 34,
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(255,255,255,.06)",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
                        flexShrink: 0,
                    }}
                    title="Cerrar"
                >
                    ✕
                </button>
            </div>

            {/* Scroll area */}
            <div style={{ marginTop: 16, overflowY: "auto", paddingRight: 4 }}>
                {/* Estado académico */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                        <div style={label}>Estado</div>

                        <div style={selectWrap}>
                            <select value={status} onChange={(e) => setStatus(e.target.value as Status)} style={select}>
                                <option value="pendiente">Pendiente</option>
                                <option value="cursando">Cursando</option>
                                <option value="final_pendiente">Final pendiente</option>
                                <option value="aprobada">Aprobada</option>
                            </select>
                            <span style={selectArrow}>▾</span>
                        </div>
                    </div>

                    {status === "aprobada" && (
                        <>
                            <div>
                                <div style={label}>Nota (1 a 10, pasos de 0.25)</div>
                                <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Ej: 8.25" style={input} />
                                {!isValidGrade && (
                                    <div style={{ marginTop: 6, color: "rgba(248,113,113,.95)", fontSize: 12 }}>
                                        La nota debe ser 1..10 y múltiplo de 0.25 (ej: 7.50, 9.25).
                                    </div>
                                )}
                            </div>

                            <div>
                                <div style={label}>Aprobación</div>

                                <div style={selectWrap}>
                                    <select value={passedVia} onChange={(e) => setPassedVia(e.target.value as any)} style={select}>
                                        <option value="">-- Seleccioná --</option>
                                        <option value="promo">Promoción</option>
                                        <option value="final">Final</option>
                                    </select>
                                    <span style={selectArrow}>▾</span>
                                </div>
                            </div>
                        </>
                    )}

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

                    <button
                        onClick={saveStatus}
                        disabled={!canSave || saving}
                        style={{
                            marginTop: 6,
                            padding: "12px 12px",
                            borderRadius: 12,
                            border: "1px solid rgba(59,130,246,.45)",
                            background: canSave ? "rgba(59,130,246,.18)" : "rgba(59,130,246,.08)",
                            color: "#fff",
                            fontWeight: 900,
                            cursor: canSave ? "pointer" : "not-allowed",
                            opacity: saving ? 0.75 : 1,
                        }}
                    >
                        {saving ? "Guardando..." : "Guardar estado"}
                    </button>
                </div>

                {/* Mini repo */}
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div style={{ fontWeight: 900, fontSize: 14 }}>Mini repo</div>
                        <button
                            onClick={() => refreshFiles()}
                            style={{
                                border: "1px solid rgba(255,255,255,.12)",
                                background: "rgba(255,255,255,.06)",
                                color: "#fff",
                                borderRadius: 10,
                                padding: "6px 10px",
                                cursor: "pointer",
                                fontWeight: 800,
                                fontSize: 12,
                            }}
                        >
                            Refrescar
                        </button>
                    </div>

                    <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)", marginBottom: 6 }}>Tipo de archivo</div>

                        <div style={selectWrap}>
                            <select value={fileType} onChange={(e) => setFileType(e.target.value as FileType)} style={select} disabled={uploading}>
                                <option value="apunte">Apunte</option>
                                <option value="tp">TP</option>
                                <option value="otro">Otro</option>
                            </select>
                            <span style={selectArrow}>▾</span>
                        </div>

                        <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)", margin: "10px 0 6px" }}>Subir archivos</div>

                        <input ref={fileInputRef} type="file" multiple onChange={onPickFiles} disabled={!subject || uploading} style={{ display: "none" }} />

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!subject || uploading}
                                style={{
                                    border: "1px solid rgba(59,130,246,.45)",
                                    background: uploading ? "rgba(59,130,246,.08)" : "rgba(59,130,246,.12)",
                                    color: "#fff",
                                    borderRadius: 10,
                                    padding: "8px 12px",
                                    cursor: !subject || uploading ? "not-allowed" : "pointer",
                                    fontWeight: 900,
                                    fontSize: 12,
                                    opacity: !subject || uploading ? 0.7 : 1,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                📎 Elegir archivos
                            </button>

                            <div
                                title={pickedLabel}
                                style={{
                                    fontSize: 12,
                                    color: "rgba(156,163,175,.95)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    minWidth: 0,
                                    flex: 1,
                                }}
                            >
                                {pickedLabel}
                            </div>
                        </div>

                        {uploading && <div style={{ marginTop: 8, fontSize: 12, color: "rgba(156,163,175,.95)" }}>Subiendo...</div>}
                    </div>

                    {repoErr && (
                        <div
                            style={{
                                marginTop: 10,
                                padding: 10,
                                borderRadius: 12,
                                background: "rgba(239,68,68,.12)",
                                border: "1px solid rgba(239,68,68,.25)",
                                color: "rgba(254,202,202,.95)",
                                fontSize: 12,
                            }}
                        >
                            {repoErr}
                        </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                        {filesLoading ? (
                            <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>Cargando archivos…</div>
                        ) : files.length === 0 ? (
                            <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>No hay archivos todavía.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {files.map((f) => (
                                    <div
                                        key={f.id}
                                        style={{
                                            border: "1px solid rgba(255,255,255,.08)",
                                            background: "rgba(0,0,0,.25)",
                                            borderRadius: 12,
                                            padding: 10,
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 10,
                                            alignItems: "center",
                                        }}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 800,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {f.title}
                                            </div>
                                            <div style={{ fontSize: 12, color: "rgba(156,163,175,.95)" }}>
                                                {f.file_type.toUpperCase()} • {new Date(f.created_at).toLocaleString()}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                            <button
                                                onClick={() => downloadFile(f)}
                                                style={{
                                                    border: "1px solid rgba(59,130,246,.45)",
                                                    background: "rgba(59,130,246,.12)",
                                                    color: "#fff",
                                                    borderRadius: 10,
                                                    padding: "6px 10px",
                                                    cursor: "pointer",
                                                    fontWeight: 800,
                                                    fontSize: 12,
                                                }}
                                            >
                                                Abrir
                                            </button>
                                            <button
                                                onClick={() => deleteFile(f)}
                                                style={{
                                                    border: "1px solid rgba(239,68,68,.45)",
                                                    background: "rgba(239,68,68,.12)",
                                                    color: "#fff",
                                                    borderRadius: 10,
                                                    padding: "6px 10px",
                                                    cursor: "pointer",
                                                    fontWeight: 800,
                                                    fontSize: 12,
                                                }}
                                            >
                                                Borrar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: 10, fontSize: 11, color: "rgba(156,163,175,.95)" }}>
                        Nota: por ahora el bucket está público (modo personal). Más adelante lo cerramos si querés.
                    </div>
                </div>
            </div>
        </div>
    );
}

const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(229,231,235,.92)",
    marginBottom: 6,
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

const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.35)",
    color: "#fff",
    outline: "none",
};