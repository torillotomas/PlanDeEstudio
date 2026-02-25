import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { redirect } from "next/navigation";



export default async function Home() {

  redirect("/map");
  const planId = "ea89a8b8-a467-47ad-8182-f4d773d650b0";

  const { data: subjects, error } = await supabase
    .from("subjects")
    .select("id,name,year,period_key,order_in_cell")
    .eq("plan_id", planId)
    .order("year", { ascending: true })
    .order("order_in_cell", { ascending: true });

  return (
    <main style={{ padding: 24 }}>
      <h1>Plan Materias</h1>

      {error && (
        <pre style={{ color: "red" }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      )}
      <Link href="/map">Ir al mapa</Link>
      <pre>{JSON.stringify(subjects, null, 2)}</pre>
    </main>
  );
}