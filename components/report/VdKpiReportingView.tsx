"use client";

import { useState, type ChangeEvent } from "react";
import { VdDailyReportingPanel } from "@/components/report/VdDailyReportingPanel";

type AreaOption = {
  id: string;
  name: string;
};

type VdKpiReportingViewProps = {
  areas: AreaOption[];
};

/**
 * Single owner of selectedAreaId for VD/admin KPI reporting.
 * Starts null (no URL hydrate) so selection is pure client state.
 * Select is inlined here so value ↔ setState has zero indirection.
 */
export function VdKpiReportingView({ areas }: VdKpiReportingViewProps) {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  function handleAreaChange(e: ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedAreaId(id ? id : null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
        <label
          htmlFor="report-area"
          className="block text-xs font-medium text-slate-500"
        >
          Visa affärsområde
        </label>
        <select
          id="report-area"
          value={selectedAreaId ?? ""}
          onChange={handleAreaChange}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        >
          <option value="">Välj affärsområde</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <VdDailyReportingPanel businessAreaId={selectedAreaId} areas={areas} />
    </div>
  );
}
