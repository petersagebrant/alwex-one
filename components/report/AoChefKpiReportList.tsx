"use client";

import { AoChefKpiReportBlock } from "@/components/report/AoChefKpiReportBlock";
import type { DailyKpiReportItem } from "@/types";

type AoChefKpiReportListProps = {
  items: DailyKpiReportItem[];
};

export function AoChefKpiReportList({ items }: AoChefKpiReportListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200/80 bg-white p-5 text-sm text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        Inga KPI:er är skapade för detta affärsområde.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={`${item.kpi.id}-${item.todayReport?.updatedAt ?? "open"}`}>
          <AoChefKpiReportBlock item={item} />
        </li>
      ))}
    </ul>
  );
}
