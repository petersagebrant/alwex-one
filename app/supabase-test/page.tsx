import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Supabase-test",
  description: "Verifierar anslutning till Supabase",
};

export default async function SupabaseTestPage() {
  let status: "ok" | "error" = "ok";
  let message = "Supabase-anslutningen fungerar";
  let detail: string | null = null;

  try {
    const supabase = await createClient();

    // Enkel anslutningskontroll utan tabellkrav eller inloggning.
    const { error } = await supabase.auth.getSession();

    if (error) {
      status = "error";
      message = "Kunde inte ansluta till Supabase";
      detail = error.message;
    }
  } catch (error) {
    status = "error";
    message = "Kunde inte ansluta till Supabase";
    detail =
      error instanceof Error
        ? error.message
        : "Ett okänt fel uppstod vid anslutningen.";
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
      <div
        className={`rounded-xl border p-6 ${
          status === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-rose-200 bg-rose-50 text-rose-900"
        }`}
      >
        <h1 className="text-lg font-semibold tracking-tight">{message}</h1>
        {detail ? (
          <p className="mt-3 text-sm leading-relaxed opacity-90">{detail}</p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed opacity-90">
            Miljövariabler är satta och klienten kunde nå Supabase Auth-API:t.
          </p>
        )}
      </div>
    </main>
  );
}
