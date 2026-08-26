import type { ReactNode } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { economicSignedTone } from "@/lib/kpi/economics";
import { isStatusTone } from "@/lib/kpi/kind";
import {
  aoEconomicPictureHeading,
  buildAoEconomicCards,
  type AoEconomicCard,
  type MonthlyEconomicPicture,
} from "@/lib/kpi/monthlyResultPresentation";

function PictureRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium tabular-nums text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}

function signedToneClass(
  value: string | null,
  options?: { zero?: "positive" | "neutral" },
): string {
  const tone = economicSignedTone(value, options);
  if (tone === "positive") return "text-emerald-700";
  if (tone === "negative") return "text-rose-700";
  return "text-slate-800";
}

function AoMetricRow({
  label,
  value,
  toneValue,
}: {
  label: string;
  value: string | null;
  toneValue?: string | null;
}) {
  const className =
    toneValue !== undefined
      ? `font-medium tabular-nums ${signedToneClass(toneValue)}`
      : "font-medium tabular-nums text-slate-800";
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={className}>{value ?? "—"}</dd>
    </div>
  );
}

function AoEconomicCardView({
  card,
  resultActual,
}: {
  card: AoEconomicCard;
  resultActual: string | null;
}) {
  const heading = (
    <>
      <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
      {card.helperText ? (
        <p className="mt-1 text-xs text-slate-500">{card.helperText}</p>
      ) : null}
    </>
  );

  if (card.kind === "margin") {
    return (
      <article className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
        {heading}
        <p
          className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight ${signedToneClass(resultActual, { zero: "positive" })}`}
        >
          {card.percentValue ?? "—"}
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
      {heading}
      <dl className="mt-3 space-y-1.5 text-sm">
        <AoMetricRow label="Utfall" value={card.actualValue} />
        <AoMetricRow label="Budget" value={card.budgetValue} />
        <AoMetricRow
          label="Avvikelse"
          value={card.deviationValue}
          toneValue={card.deviationValue}
        />
      </dl>
    </article>
  );
}

type MonthlyEconomicPictureViewProps = {
  picture: MonthlyEconomicPicture;
  variant?: "full" | "compact" | "ao";
  monthPicker?: ReactNode;
};

/** Månadens ekonomiska bild: Resultat (huvud) + Omsättning mot budget. */
export function MonthlyEconomicPictureView({
  picture,
  variant = "full",
  monthPicker,
}: MonthlyEconomicPictureViewProps) {
  const title = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-900">
        {variant === "compact"
          ? `Ekonomi – ${picture.periodLabel}`
          : variant === "ao"
            ? aoEconomicPictureHeading(picture.periodMonth)
            : `Månadens ekonomiska bild – ${picture.periodLabel}`}
      </h2>
      {picture.result.statusValue && isStatusTone(picture.result.statusValue) ? (
        <StatusBadge status={picture.result.statusValue} />
      ) : null}
    </div>
  );

  if (variant === "ao") {
    const cards = buildAoEconomicCards(picture);
    const pending =
      !picture.result.isReported && !picture.revenue.isReported;
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        <h2 className="text-base font-semibold text-slate-900">
          {aoEconomicPictureHeading(picture.periodMonth)}
        </h2>
        {pending ? (
          <p className="mt-2 text-sm text-slate-500">Inväntar bokslut</p>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <AoEconomicCardView
              key={card.kind}
              card={card}
              resultActual={picture.result.actualValue}
            />
          ))}
        </div>
      </section>
    );
  }

  if (variant === "compact") {
    const body = (
      <dl className="space-y-0.5 text-sm tabular-nums text-slate-600">
        <div>
          <dt className="inline">Resultatmånad: </dt>
          <dd className="inline font-medium text-slate-800">
            {picture.periodLabel}
          </dd>
        </div>
        <div>
          <dt className="inline">Resultat: </dt>
          <dd className="inline font-medium text-slate-800">
            {picture.result.isReported
              ? `${picture.result.actualValue} / ${picture.result.budgetValue} (${picture.result.deviationValue})`
              : "Inväntar bokslut"}
          </dd>
        </div>
        {picture.revenue.isReported ? (
          <div>
            <dt className="inline">Omsättning: </dt>
            <dd className="inline font-medium text-slate-800">
              {picture.revenue.actualValue} / {picture.revenue.budgetValue}
            </dd>
          </div>
        ) : null}
      </dl>
    );
    if (picture.resultHref) {
      return (
        <Link href={picture.resultHref} className="block hover:text-slate-900">
          {body}
        </Link>
      );
    }
    return body;
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      {title}
      {monthPicker ? <div className="mt-3">{monthPicker}</div> : null}
      <dl className="mt-4 space-y-2 text-sm tabular-nums">
        <PictureRow label="Resultatmånad" value={picture.periodLabel} />
        <PictureRow label="Omsättning utfall" value={picture.revenue.actualValue} />
        <PictureRow label="Omsättning budget" value={picture.revenue.budgetValue} />
        <PictureRow
          label="Omsättning avvikelse"
          value={picture.revenue.deviationValue}
        />
        <PictureRow
          label="Omsättning avvikelse %"
          value={picture.revenue.deviationPercent}
        />
        <PictureRow label="Resultat utfall" value={picture.result.actualValue} />
        <PictureRow label="Resultat budget" value={picture.result.budgetValue} />
        <PictureRow
          label="Resultat avvikelse"
          value={picture.result.deviationValue}
        />
        <PictureRow
          label="Resultat avvikelse %"
          value={picture.result.deviationPercent}
        />
        <PictureRow label="Resultatmarginal" value={picture.margin} />
        <PictureRow
          label="Ackumulerad omsättning utfall"
          value={picture.ytdRevenue.actualValue}
        />
        <PictureRow
          label="Ackumulerad omsättning budget"
          value={picture.ytdRevenue.budgetValue}
        />
        <PictureRow
          label="Ackumulerad omsättning avvikelse"
          value={picture.ytdRevenue.deviationValue}
        />
        <PictureRow
          label="Ackumulerad omsättning avvikelse %"
          value={picture.ytdRevenue.deviationPercent}
        />
        <PictureRow
          label="Ackumulerat resultat utfall"
          value={picture.ytdResult.actualValue}
        />
        <PictureRow
          label="Ackumulerat resultat budget"
          value={picture.ytdResult.budgetValue}
        />
        <PictureRow
          label="Ackumulerat resultat avvikelse"
          value={picture.ytdResult.deviationValue}
        />
        <PictureRow
          label="Ackumulerat resultat avvikelse %"
          value={picture.ytdResult.deviationPercent}
        />
      </dl>
    </section>
  );
}
