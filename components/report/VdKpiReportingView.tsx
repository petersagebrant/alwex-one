"use client";

import { useState, type ChangeEvent } from "react";
import { DailyReportDatePicker } from "@/components/report/DailyReportDatePicker";
import { VdDailyReportingPanel } from "@/components/report/VdDailyReportingPanel";

type AreaOption = {
  id: string;
  name: string;
};

type VdKpiReportingViewProps = {
  areas: AreaOption[];
  defaultReportDate: string;
  maxReportDate: string;
};

/**
 * Single owner of selectedAreaId and reportDate for VD/admin KPI reporting.
 * Area starts null (no URL hydrate). Date defaults to Stockholm yesterday.
 */
export function VdKpiReportingView({
  areas,
  defaultReportDate,
  maxReportDate,
}: VdKpiReportingViewProps) {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState(defaultReportDate);

  function handleAreaChange(e: ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedAreaId(id ? id : null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label
            htmlFor="report-area"
            className="block text-xs font-medium text-slate-500"
          >
            Visa affärsområde
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
          </label>
          <DailyReportDatePicker
            value={reportDate}
            max={maxReportDate}
            onChange={setReportDate}
          />
        </div>
      </div>

      <VdDailyReportingPanel
        businessAreaId={selectedAreaId}
        areas={areas}
        reportDate={reportDate}
      />
    </div>
  );
}
