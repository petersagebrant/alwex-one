import type { Metadata } from "next";
import { PublicReportForm } from "@/components/rapportera/PublicReportForm";
import {
  getPublicOperationalReportAreas,
  getPublicReportingUnits,
} from "@/services/operationalReports";

export const metadata: Metadata = {
  title: "Rapportera till Alwex",
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
  const [areas, units] = await Promise.all([
    getPublicOperationalReportAreas().catch(() => []),
    getPublicReportingUnits().catch(() => []),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] px-4 py-10 text-neutral-900">
      <main className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          RAPPORTERA TILL ALWEX
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Rapportera något som Alwex behöver känna till eller följa upp.
        </p>

        <PublicReportForm
          areas={areas}
          units={units}
          initialSent={sent}
          error={error}
        />
      </main>
    </div>
  );
}
