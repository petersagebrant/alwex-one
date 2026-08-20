"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DailyKpiReportCard } from "@/components/report/DailyKpiReportCard";
import type { DailyKpiReportItem } from "@/types";

type AoChefKpiReportListProps = {
  items: DailyKpiReportItem[];
};

/**
 * AO-chef daily list with the same collapse UX as VD DailyKpiReportList:
 * open → save → collapse → reopen with saved values.
 */
export function AoChefKpiReportList({ items }: AoChefKpiReportListProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200/80 bg-white p-5 text-sm text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        Inga KPI:er är skapade för detta affärsområde.
      </p>
    );
  }

  function handleToggle(kpiId: string) {
    setExpandedId((current) => (current === kpiId ? null : kpiId));
  }

  function handleReported() {
    setExpandedId(null);
    router.refresh();
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={`${item.kpi.id}-${item.todayReport?.updatedAt ?? "open"}`}>
          <DailyKpiReportCard
            item={item}
            expanded={expandedId === item.kpi.id}
            onToggle={() => handleToggle(item.kpi.id)}
            onReported={handleReported}
          />
        </li>
      ))}
    </ul>
  );
}
