import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  InfoPanel,
  SectionHeader,
  SummaryCard,
} from "@/components/ui";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import { getDecisionById } from "@/services/decisions";

type DecisionDetailPageProps = {
  params: Promise<{ id: string }>;
};

const statusClass: Record<string, string> = {
  Planerat: "bg-neutral-100 text-neutral-700",
  Pågår: "bg-indigo-50 text-indigo-700",
  Klart: "bg-emerald-50 text-emerald-700",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const decision = await getDecisionById(id).catch(() => null);
  return {
    title: decision
      ? `${decision.title} | Beslut | Alwex One`
      : "Beslut | Alwex One",
    description: "Beslutsdetalj",
  };
}

export default async function DecisionDetailPage({
  params,
}: DecisionDetailPageProps) {
  const { id } = await params;
  const decision = await getDecisionById(id).catch(() => null);

  if (!decision) {
    notFound();
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="decisions" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <Link href="/admin/decisions" className="hover:text-neutral-800">
              Beslut
            </Link>
            <span aria-hidden>/</span>
            <span className="text-neutral-800">{decision.title}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                {decision.title}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {decision.businessAreaName}
                {decision.owner ? ` · ${decision.owner}` : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass[decision.status] ?? statusClass.Planerat}`}
              >
                {decision.status}
              </span>
              <Link
                href={`/admin/decisions?edit=${decision.id}`}
                className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline"
              >
                Ändra
              </Link>
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <SectionHeader title="Översikt" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Status"
              value={decision.status}
            />
            <SummaryCard
              title="Ansvarig"
              value={decision.owner ?? "—"}
            />
            <SummaryCard
              title="Mötesdatum"
              value={
                decision.meetingDate
                  ? formatDateSv(decision.meetingDate)
                  : "—"
              }
            />
            <SummaryCard
              title="Förfaller"
              value={
                decision.dueDate ? formatDateSv(decision.dueDate) : "—"
              }
            />
          </div>
        </section>

        <InfoPanel title="Detaljer" variant="info" showLabel={false}>
          <dl className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Affärsområde</dt>
              <dd className="font-medium text-slate-800">
                {decision.businessAreaName}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Skapad</dt>
              <dd className="font-medium text-slate-800">
                {formatDateTimeSv(decision.createdAt)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Uppdaterad</dt>
              <dd className="font-medium text-slate-800">
                {formatDateTimeSv(decision.updatedAt)}
              </dd>
            </div>
          </dl>
        </InfoPanel>

        <InfoPanel title="Beskrivning" variant="vd-comment" showLabel={false}>
          {decision.description?.trim()
            ? decision.description
            : "Ingen beskrivning registrerad ännu."}
        </InfoPanel>
      </main>
    </div>
  );
}
