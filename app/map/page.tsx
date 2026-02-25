// app/map/page.tsx
"use client";

import LogoutButton from "./LogoutButton";
import CareerTimeline from "./CareerTimeline";

export default function MapPage() {
    const careerTitle = "Tecnicatura en Informática Aplicada";

    return (
        <main style={{ height: "100vh" }}>
            <div
                style={{
                    padding: 12,
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                }}
            >
                <LogoutButton />
                <h1 style={{ margin: 0 }}>{careerTitle}</h1>
            </div>

            <div style={{ height: "calc(100vh - 56px)" }}>
                <CareerTimeline />
            </div>
        </main>
    );
}