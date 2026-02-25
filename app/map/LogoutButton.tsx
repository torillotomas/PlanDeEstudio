"use client";

import { supabase } from "@/lib/supabaseClient";

export default function LogoutButton() {
    const onLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    return (
        <button
            onClick={onLogout}
            style={{
                appearance: "none",
                border: "none",
                background: "transparent",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 14,
                padding: 0,
            }}
        >
            ← Cerrar sesión
        </button>
    );
}