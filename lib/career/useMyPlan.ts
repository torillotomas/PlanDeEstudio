"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type MyPlan = {
    id: string;
    name: string;
    mode: string | null;
    years_count: number | null;
    periods: string | null;
};

export function useMyPlan() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");

    const [plan, setPlan] = useState<MyPlan | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = () => setRefreshKey((k) => k + 1);

    useEffect(() => {
        let alive = true;

        (async () => {
            setLoading(true);
            setError("");

            try {
                // 1) Usuario actual
                const { data: userData, error: userErr } = await supabase.auth.getUser();
                if (!alive) return;
                if (userErr) throw userErr;

                const uid = userData?.user?.id;
                if (!uid) throw new Error("No hay usuario autenticado");

                // 2) Traer UN plan del usuario (por ahora 1 plan por user)
                const { data, error: planErr } = await supabase
                    .from("plans")
                    .select("id,name,mode,years_count,periods")
                    .eq("owner_id", uid)
                    .order("created_at", { ascending: false })
                    .limit(1);

                if (!alive) return;
                if (planErr) throw planErr;

                const row = (data?.[0] ?? null) as MyPlan | null;
                setPlan(row);
            } catch (e: any) {
                if (!alive) return;
                setPlan(null);
                setError(e?.message ?? "Error cargando plan");
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [refreshKey]);

    const planId = useMemo(() => plan?.id ?? null, [plan]);

    return {
        loading,
        error,
        plan,
        planId,
        refresh,
    };
}