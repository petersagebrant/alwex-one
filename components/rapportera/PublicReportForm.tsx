"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  OPERATIONAL_REPORT_BODY_MAX,
  OPERATIONAL_REPORT_HAULIER_MAX,
  OPERATIONAL_REPORT_PRIORITY_LABELS,
  OPERATIONAL_REPORT_PRIORITIES,
  type OperationalReportAreaOption,
} from "@/types/operational-report";
import { OPERATIONAL_REPORT_HONEYPOT_FIELD } from "@/lib/operational-reports/validate";
import { submitOperationalReportAction } from "@/app/rapportera/actions";

type PublicReportFormProps = {
  areas: OperationalReportAreaOption[];
  initialSent: boolean;
  error: string | null;
};

export function PublicReportForm({
  areas,
  initialSent,
  error,
}: PublicReportFormProps) {
  const router = useRouter();
  const [sent, setSent] = useState(initialSent);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    setSent(initialSent);
  }, [initialSent]);

  function reportAnother() {
    setSent(false);
    setFormKey((current) => current + 1);
    router.replace("/rapportera", { scroll: false });
  }

  if (sent) {
    return (
      <div className="mt-8 space-y-4">
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          Tack. Informationen är skickad till Alwex.
        </p>
        <button
          type="button"
          onClick={reportAnother}
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
        >
          Rapportera en till händelse
        </button>
      </div>
    );
  }

  return (
    <form
      key={formKey}
      action={submitOperationalReportAction}
      className="mt-8 space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="hidden" aria-hidden="true">
        <label htmlFor={OPERATIONAL_REPORT_HONEYPOT_FIELD}>Webbplats</label>
        <input
          id={OPERATIONAL_REPORT_HONEYPOT_FIELD}
          name={OPERATIONAL_REPORT_HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <label
          htmlFor="haulierName"
          className="block text-xs font-medium text-neutral-500"
        >
          Åkeri
        </label>
        <input
          id="haulierName"
          name="haulierName"
          type="text"
          required
          maxLength={OPERATIONAL_REPORT_HAULIER_MAX}
          autoComplete="organization"
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
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
          defaultValue=""
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
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
          htmlFor="body"
          className="block text-xs font-medium text-neutral-500"
        >
          Vad har hänt?
        </label>
        <textarea
          id="body"
          name="body"
          required
          maxLength={OPERATIONAL_REPORT_BODY_MAX}
          rows={5}
          className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <fieldset>
        <legend className="block text-xs font-medium text-neutral-500">
          Prioritet
        </legend>
        <div className="mt-2 space-y-2">
          {OPERATIONAL_REPORT_PRIORITIES.map((priority) => (
            <label
              key={priority}
              className="flex items-center gap-2.5 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-800"
            >
              <input
                type="radio"
                name="priority"
                value={priority}
                required
                defaultChecked={priority === "info"}
                className="h-4 w-4"
              />
              {OPERATIONAL_REPORT_PRIORITY_LABELS[priority]}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="w-full rounded-xl bg-[#0b1220] px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Skicka
      </button>

      <p className="text-xs leading-5 text-neutral-500">
        Vid akut fara eller olycka – kontakta alltid ansvarig på Alwex direkt.
      </p>
    </form>
  );
}
