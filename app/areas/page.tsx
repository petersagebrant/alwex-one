import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { AreaCardGrid } from "@/components/areas/AreaCardGrid";
import { getBusinessAreas } from "@/services/businessAreas";

export const metadata: Metadata = {
  title: "Affärsområden | LEIR",
  description: "Översikt över Alwex affärsområden, mål och aktiviteter",
};

export default async function AreasPage() {
  const areas = await getBusinessAreas();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="areas" />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Affärsområden
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {areas.length} områden · status, mål och aktiviteter
            </p>
          </div>
        </div>

        {areas.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Inga verksamheter finns ännu.
          </p>
        ) : (
          <AreaCardGrid areas={areas} />
        )}
      </main>
    </div>
  );
}
