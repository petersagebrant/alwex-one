"use client";

import { useRouter } from "next/navigation";

type MonthlyEconomicMonthPickerProps = {
  kpiId: string;
  value: string;
};

/** Resultat detail: selected month lives in `?month=YYYY-MM` so the RSC reloads. */
export function MonthlyEconomicMonthPicker({
  kpiId,
  value,
}: MonthlyEconomicMonthPickerProps) {
  const router = useRouter();
  const monthValue = value.slice(0, 7);

  return (
    <label className="block text-xs font-medium text-slate-500">
      Visa månad
      <input
        type="month"
        value={monthValue}
        onChange={(event) => {
          const next = event.target.value;
          if (!/^\d{4}-\d{2}$/.test(next)) return;
          router.push(`/kpis/${kpiId}?month=${encodeURIComponent(next)}`);
        }}
        className="mt-1.5 w-full max-w-[12rem] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
      />
    </label>
  );
}
