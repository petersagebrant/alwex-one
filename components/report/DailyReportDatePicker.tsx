"use client";

type DailyReportDatePickerProps = {
  value: string;
  max: string;
  disabled?: boolean;
  onChange: (date: string) => void;
};

/** Native date input for daily reporting. Max is Stockholm today. */
export function DailyReportDatePicker({
  value,
  max,
  disabled,
  onChange,
}: DailyReportDatePickerProps) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      Rapportdatum
      <input
        type="date"
        value={value}
        max={max}
        required
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) return;
          onChange(next);
        }}
        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
      />
    </label>
  );
}
