"use client";

import { useRouter } from "next/navigation";
import { DailyReportDatePicker } from "@/components/report/DailyReportDatePicker";

type AoDailyReportDatePickerProps = {
  value: string;
  max: string;
};

/** AO reporting: date lives in `?date=YYYY-MM-DD` so the RSC reloads. */
export function AoDailyReportDatePicker({
  value,
  max,
}: AoDailyReportDatePickerProps) {
  const router = useRouter();

  return (
    <div className="max-w-xs">
      <DailyReportDatePicker
        value={value}
        max={max}
        onChange={(date) => {
          router.push(`/report/kpis?date=${encodeURIComponent(date)}`);
        }}
      />
    </div>
  );
}
