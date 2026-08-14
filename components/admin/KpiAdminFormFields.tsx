"use client";

import { useMemo, useState } from "react";
import { BeraknadTypeBadge } from "@/components/kpis/BeraknadTypeBadge";
import { StatistikTypeBadge } from "@/components/kpis/StatistikTypeBadge";
import type { KPIListItem } from "@/services/kpis";
import type { KpiKind } from "@/types";

type AreaOption = { id: string; name: string };

type KpiOption = {
  id: string;
  name: string;
  businessAreaId: string;
  kind: KpiKind;
};

type KpiAdminFormFieldsProps = {
  areas: AreaOption[];
  kpis?: KpiOption[];
  kpi?: KPIListItem | null;
};

export function KpiAdminFormFields({
  areas,
  kpis = [],
  kpi,
}: KpiAdminFormFieldsProps) {
  const [kind, setKind] = useState<KpiKind>(kpi?.kind ?? "TARGET");
  const [businessAreaId, setBusinessAreaId] = useState(
    kpi?.businessAreaId ?? "",
  );
  const isStatistic = kind === "STATISTIC";
  const isCalculated = kind === "CALCULATED";
  const isNonTarget = isStatistic || isCalculated;

  const inputOptions = useMemo(() => {
    return kpis.filter(
      (option) =>
        option.businessAreaId === businessAreaId &&
        option.kind !== "CALCULATED" &&
        option.id !== kpi?.id,
    );
  }, [businessAreaId, kpi?.id, kpis]);

  return (
    <>
      <div>
        <label
          htmlFor="kpiKind"
          className="block text-xs font-medium text-neutral-500"
        >
          Typ
        </label>
        <select
          id="kpiKind"
          name="kpiKind"
          value={kind}
          onChange={(event) => setKind(event.target.value as KpiKind)}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        >
          <option value="TARGET">Vanlig KPI (med mål / status)</option>
          <option value="STATISTIC">Statistik / inget mål</option>
          <option value="CALCULATED">Beräknad (t.ex. division)</option>
        </select>
        {isStatistic ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
            <StatistikTypeBadge />
            <span>Ingen Grön/Gul/Röd-status. Värden sparas i historiken.</span>
          </div>
        ) : null}
        {isCalculated ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
            <BeraknadTypeBadge />
            <span>
              Beräknas automatiskt från andra KPI:er. Syns inte i manuell
              rapportering.
            </span>
          </div>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="businessAreaId"
          className="block text-xs font-medium text-neutral-500"
        >
          Affärsområde
        </label>
        <select
          id="businessAreaId"
          name="businessAreaId"
          required
          value={businessAreaId}
          onChange={(event) => setBusinessAreaId(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        >
          <option value="" disabled>
            Välj affärsområde
          </option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="name"
          className="block text-xs font-medium text-neutral-500"
        >
          Namn
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={kpi?.name ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <div>
        <label
          htmlFor="category"
          className="block text-xs font-medium text-neutral-500"
        >
          Kategori
        </label>
        <input
          id="category"
          name="category"
          type="text"
          defaultValue={kpi?.category ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      {isCalculated ? (
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/70 p-4">
          <input type="hidden" name="calcOperator" value="DIVIDE" />
          <p className="text-xs font-medium text-neutral-700">
            Beräkning: täljare ÷ nämnare (samma rapportdatum)
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="calcNumeratorKpiId"
                className="block text-xs font-medium text-neutral-500"
              >
                Täljare
              </label>
              <select
                id="calcNumeratorKpiId"
                name="calcNumeratorKpiId"
                required
                defaultValue={kpi?.calcNumeratorKpiId ?? ""}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              >
                <option value="" disabled>
                  Välj KPI
                </option>
                {inputOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="calcDenominatorKpiId"
                className="block text-xs font-medium text-neutral-500"
              >
                Nämnare
              </label>
              <select
                id="calcDenominatorKpiId"
                name="calcDenominatorKpiId"
                required
                defaultValue={kpi?.calcDenominatorKpiId ?? ""}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              >
                <option value="" disabled>
                  Välj KPI
                </option>
                {inputOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!businessAreaId ? (
            <p className="text-[11px] text-neutral-500">
              Välj affärsområde för att se tillgängliga KPI:er.
            </p>
          ) : inputOptions.length === 0 ? (
            <p className="text-[11px] text-amber-700">
              Inga manuella KPI:er i området ännu. Skapa Statistik/mål-KPI:er
              först.
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={`grid grid-cols-1 gap-4 ${isNonTarget ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
      >
        {!isCalculated ? (
          <div>
            <label
              htmlFor="currentValue"
              className="block text-xs font-medium text-neutral-500"
            >
              Nuvarande värde
            </label>
            <input
              id="currentValue"
              name="currentValue"
              type="text"
              defaultValue={kpi?.currentValue ?? ""}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
            />
          </div>
        ) : null}

        {!isNonTarget ? (
          <div>
            <label
              htmlFor="targetValue"
              className="block text-xs font-medium text-neutral-500"
            >
              Målvärde
            </label>
            <input
              id="targetValue"
              name="targetValue"
              type="text"
              defaultValue={kpi?.targetValue ?? ""}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
            />
          </div>
        ) : null}

        <div>
          <label
            htmlFor="unit"
            className="block text-xs font-medium text-neutral-500"
          >
            Enhet
          </label>
          <input
            id="unit"
            name="unit"
            type="text"
            defaultValue={kpi?.unit ?? ""}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!isNonTarget ? (
          <div>
            <label
              htmlFor="status"
              className="block text-xs font-medium text-neutral-500"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={
                kpi?.status === "Statistik" ? "Gul" : (kpi?.status ?? "Gul")
              }
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
            >
              <option value="Grön">Grön</option>
              <option value="Gul">Gul</option>
              <option value="Röd">Röd</option>
            </select>
            <p className="mt-1 text-[11px] text-neutral-500">
              Vid automatisk riktning beräknas status om värde och mål finns.
            </p>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="trend"
            className="block text-xs font-medium text-neutral-500"
          >
            Trend
          </label>
          <select
            id="trend"
            name="trend"
            defaultValue={kpi?.trend ?? "Oförändrad"}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          >
            <option value="Upp">Upp</option>
            <option value="Oförändrad">Oförändrad</option>
            <option value="Ner">Ner</option>
          </select>
        </div>
      </div>

      {!isNonTarget ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="direction"
                className="block text-xs font-medium text-neutral-500"
              >
                Riktning
              </label>
              <select
                id="direction"
                name="direction"
                defaultValue={kpi?.direction ?? ""}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              >
                <option value="">Manuell status</option>
                <option value="HIGHER_IS_BETTER">Högre är bättre</option>
                <option value="LOWER_IS_BETTER">Lägre är bättre</option>
                <option value="TARGET_IS_BEST">Närmast mål är bäst</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="toleranceType"
                className="block text-xs font-medium text-neutral-500"
              >
                Toleranstyp
              </label>
              <select
                id="toleranceType"
                name="toleranceType"
                defaultValue={kpi?.toleranceType ?? ""}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              >
                <option value="">Standard (procent / absolut vid ≈0)</option>
                <option value="PERCENT">Procentuell tolerans</option>
                <option value="ABSOLUTE">Absolut tolerans</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="greenTolerance"
                className="block text-xs font-medium text-neutral-500"
              >
                Grön tolerans
              </label>
              <input
                id="greenTolerance"
                name="greenTolerance"
                type="text"
                inputMode="decimal"
                defaultValue={
                  kpi?.greenTolerance != null ? String(kpi.greenTolerance) : ""
                }
                placeholder="valfritt, t.ex. 0,5"
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                För Närmast mål. Tom = liten automatisk grön zon.
              </p>
            </div>

            <div>
              <label
                htmlFor="yellowTolerance"
                className="block text-xs font-medium text-neutral-500"
              >
                Gul tolerans
              </label>
              <input
                id="yellowTolerance"
                name="yellowTolerance"
                type="text"
                inputMode="decimal"
                defaultValue={
                  kpi?.yellowTolerance != null ? String(kpi.yellowTolerance) : ""
                }
                placeholder="t.ex. 5 eller 0,2"
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                Grön tolerans får inte vara större än gul.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500">
            Absolut tolerans + enhet %: Avvikelsen anges i procentenheter från
            målvärdet.
          </p>
        </>
      ) : null}
    </>
  );
}
