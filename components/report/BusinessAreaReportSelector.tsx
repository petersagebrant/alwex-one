"use client";

type AreaOption = {
  id: string;
  name: string;
};

type BusinessAreaReportSelectorProps = {
  areas: AreaOption[];
  selectedAreaId: string | null;
  onAreaChange: (areaId: string) => void;
};

/**
 * Controlled business-area select. Parent owns value; no navigation.
 */
export function BusinessAreaReportSelector({
  areas,
  selectedAreaId,
  onAreaChange,
}: BusinessAreaReportSelectorProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
      <label
        htmlFor="report-area"
        className="block text-xs font-medium text-slate-500"
      >
        Visa affärsområde
      </label>
      <select
        id="report-area"
        name="area"
        value={selectedAreaId ?? ""}
        onChange={(e) => {
          onAreaChange(e.target.value);
        }}
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
  );
}
