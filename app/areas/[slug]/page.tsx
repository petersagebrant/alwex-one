import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { AreaActivitiesList } from "@/components/areas/AreaActivitiesList";
import { AreaDetailHeader } from "@/components/areas/AreaDetailHeader";
import { AreaGoalsList } from "@/components/areas/AreaGoalsList";
import { AreaHistoryList } from "@/components/areas/AreaHistoryList";
import { AreaKpiList } from "@/components/areas/AreaKpiList";
import { StatusPill } from "@/components/common/StatusPill";
import {
  getAllAreaSlugs,
  getBusinessAreaBySlug,
  getHistoryByArea,
} from "@/data/mock";
import { fetchBusinessAreaBySlug } from "@/lib/supabase/business-areas";
import { getActivitiesByBusinessAreaId } from "@/services/activities";
import { getGoalsByBusinessAreaId } from "@/services/goals";
import { getKPIsByBusinessArea } from "@/services/kpis";
import type { StatusTone } from "@/types";

type AreaDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function toStatusTone(value: string): StatusTone {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return "Gul";
}

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
  const areaKpis = dbArea ? await getKPIsByBusinessArea(dbArea.id) : [];

  const areaHistory = getHistoryByArea(slug);
  const totalStatus = dbArea ? toStatusTone(dbArea.status) : area.status;

  const summaryCards = [
    {
      id: "kpis",
      label: "KPI",
      value: String(areaKpis.length),
    },
    {
      id: "goals",
      label: "Mål",
      value: String(areaGoals.length),
    },
    {
      id: "activities",
      label: "Aktiviteter",
      value: String(areaActivities.length),
    },
  ] as const;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="areas" />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8 lg:px-8">
        <AreaDetailHeader area={area} />

        <section
          aria-label="Sammanfattning"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {summaryCards.map((card) => (
            <article
              key={card.id}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
            >
              <p className="text-xs font-medium text-neutral-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
                {card.value}
              </p>
            </article>
          ))}

          <article className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <p className="text-xs font-medium text-neutral-500">Total status</p>
            <div className="mt-3">
              <StatusPill status={totalStatus} />
            </div>
          </article>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            VD-kommentar
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            Ingen VD-kommentar registrerad ännu.
          </p>
        </section>

        <AreaKpiList kpis={areaKpis} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <AreaGoalsList goals={areaGoals} />
            <AreaActivitiesList activities={areaActivities} />
          </div>
          <div className="space-y-4">
            <AreaHistoryList events={areaHistory} />
          </div>
        </div>
      </main>
    </div>
  );
}
