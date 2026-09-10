import type { Metadata } from "next";
import { getPublicOperationalReportAreas } from "@/services/operationalReports";
import { PublicReportForm } from "@/components/rapportera/PublicReportForm";

export const metadata: Metadata = {
  title: "Rapportera",
  description: "Skicka information till Alwex",
};

type RapporteraPageProps = {
  searchParams: Promise<{ skickat?: string; fel?: string }>;
};

export default async function RapporteraPage({
  searchParams,
}: RapporteraPageProps) {
  const params = await searchParams;
  const sent = params.skickat === "1";
  const error = params.fel?.trim() || null;
  const areas = await getPublicOperationalReportAreas().catch(() => []);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] px-4 py-10 text-neutral-900">
      <main className="mx-auto w-full max-w-md">
        <p className="text-[13px] font-semibold tracking-[0.08em] text-neutral-900 uppercase">
          Alwex
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
          Rapportera
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Rapportera något som Alwex behöver känna till eller följa upp.
        </p>

        <PublicReportForm areas={areas} initialSent={sent} error={error} />
      </main>
    </div>
  );
}
