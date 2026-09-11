"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clientIpFromHeaders,
  hashClientIp,
} from "@/lib/operational-reports/client-ip";
import {
  OPERATIONAL_REPORT_HONEYPOT_FIELD,
  parseOperationalReportForm,
} from "@/lib/operational-reports/validate";
import { consumeOperationalReportRateLimit } from "@/lib/supabase/operational-reports";
import {
  getPublicOperationalReportAreas,
  getPublicReportingUnits,
  submitPublicOperationalReport,
} from "@/services/operationalReports";

function firstParam(value: FormDataEntryValue | null): string {
  return String(value ?? "");
}

export async function submitOperationalReportAction(formData: FormData) {
  const fields = {
    reportingUnitId: firstParam(formData.get("reportingUnitId")),
    businessAreaId: firstParam(formData.get("businessAreaId")),
    body: firstParam(formData.get("body")),
    priority: firstParam(formData.get("priority")),
    category: firstParam(formData.get("category")) || "ovrigt",
    honeypot: firstParam(formData.get(OPERATIONAL_REPORT_HONEYPOT_FIELD)),
  };

  if (fields.honeypot.trim()) {
    redirect("/rapportera?skickat=1");
  }

  let areas: Awaited<ReturnType<typeof getPublicOperationalReportAreas>>;
  let units: Awaited<ReturnType<typeof getPublicReportingUnits>>;
  try {
    [areas, units] = await Promise.all([
      getPublicOperationalReportAreas(),
      getPublicReportingUnits(),
    ]);
  } catch {
    redirect(
      `/rapportera?fel=${encodeURIComponent("Kunde inte hämta underlag. Försök igen.")}`,
    );
  }

  const allowedAreas = new Set(areas.map((area) => area.id));
  const allowedUnits = new Map(units.map((unit) => [unit.id, unit]));
  const validated = parseOperationalReportForm(
    fields,
    allowedAreas,
    allowedUnits,
  );

  if (!validated.ok) {
    if (validated.error === "honeypot") {
      redirect("/rapportera?skickat=1");
    }
    redirect(`/rapportera?fel=${encodeURIComponent(validated.error)}`);
  }

  const headerStore = await headers();
  const ipHash = hashClientIp(clientIpFromHeaders(headerStore));

  try {
    const allowedByLimit = await consumeOperationalReportRateLimit(ipHash);
    if (!allowedByLimit) {
      redirect(
        `/rapportera?fel=${encodeURIComponent("För många försök. Vänta en stund och försök igen.")}`,
      );
    }
    await submitPublicOperationalReport(validated.value);
  } catch {
    redirect(
      `/rapportera?fel=${encodeURIComponent("Kunde inte skicka just nu. Försök igen.")}`,
    );
  }

  redirect("/rapportera?skickat=1");
}
