"use client";

export default function AreasError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          Affärsområdesdata kunde inte hämtas
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Informationen visas inte eftersom datakällan inte är tillgänglig just
          nu. Försök igen. Om felet kvarstår, kontakta administratören.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          Försök igen
        </button>
      </section>
    </main>
  );
}
