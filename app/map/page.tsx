import Link from "next/link";
import CareerMap from "./CareerMap";

export default function MapPage() {
    return (
        <main style={{ height: "100vh" }}>
            <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <Link href="/">← Volver</Link>
                <h1 style={{ margin: 0 }}>Mapa de materias</h1>
            </div>

            <div style={{ height: "calc(100vh - 56px)" }}>
                <CareerMap />
            </div>
        </main>
    );
}