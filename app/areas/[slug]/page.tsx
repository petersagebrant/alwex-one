import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { AreaActivitiesList } from "@/components/areas/AreaActivitiesList";
import { AreaDetailHeader } from "@/components/areas/AreaDetailHeader";
import { AreaGoalsList } from "@/components/areas/AreaGoalsList";
import { AreaHistoryList } from "@/components/areas/AreaHistoryList";
import { AreaKpiList } from "@/components/areas/AreaKpiList";
import {
  getAllAreaSlugs,
  getBusinessAreaBySlug,
  getHistoryByArea,
} from "@/data/mock";
import { fetchBusinessAreaBySlug } from "@/lib/supabase/business-areas";
import { getActivitiesByBusinessAreaId } from "@/services/activities";
import { getGoalsByBusinessAreaId } from "@/services/goals";
import { getKPIsByBusinessArea } from "@/services/kpis";

type AreaDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllAreaSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: AreaDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const area = getBusinessAreaBySlug(slug);

  return {
    title: area ? `${area.name} | Alwex One` : "Affärsområde | Alwex One",
    description: area?.description,
  };
}

export default async function AreaDetailPage({ params }: AreaDetailPageProps) {
  const { slug } = await params;
  const area = getBusinessAreaBySlug(slug);

  if (!area) {
    notFound();
  }

  const dbArea = await fetchBusinessAreaBySlug(slug);
  const areaGoals = dbArea
    ? await getGoalsByBusinessAreaId(dbArea.id)
    : [];
  const areaActivities = dbArea
    ? await getActivitiesByBusinessAreaId(dbArea.id)
    : [];
  const areaKpis = dbArea
    ? await getKPIsByBusinessArea(dbArea.id)
    : [];

  const areaHistory = getHistoryByArea(slug);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="areas" />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8 lg:px-8">
        <AreaDetailHeader area={area} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <AreaGoalsList goals={areaGoals} />
            <AreaActivitiesList activities={areaActivities} />
          </div>
          <div className="space-y-4">
            <AreaKpiList kpis={areaKpis} />
            <AreaHistoryList events={areaHistory} />
          </div>
        </div>
      </main>
    </div>
  );
}
