import {
  OPERATIONAL_REPORT_BODY_MAX,
  OPERATIONAL_REPORT_HAULIER_MAX,
  OPERATIONAL_REPORT_PRIORITIES,
  type CreateOperationalReportInput,
  type OperationalReportPriority,
  type PublicReportingUnitOption,
} from "@/types/operational-report";
import { parsePublicReportCategory } from "./category";

export const OPERATIONAL_REPORT_HONEYPOT_FIELD = "website";

export type OperationalReportFormFields = {
  reportingUnitId: string;
  businessAreaId: string;
  body: string;
  priority: string;
  category: string;
  honeypot: string;
};

export function isOperationalReportPriority(
  value: string | null | undefined,
): value is OperationalReportPriority {
  return (OPERATIONAL_REPORT_PRIORITIES as readonly string[]).includes(
    value ?? "",
  );
}

export function isHoneypotFilled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function parseOperationalReportForm(
  fields: OperationalReportFormFields,
  allowedAreaIds: ReadonlySet<string>,
  allowedUnits: ReadonlyMap<string, PublicReportingUnitOption>,
):
  | { ok: true; value: CreateOperationalReportInput }
  | { ok: false; error: string } {
  if (isHoneypotFilled(fields.honeypot)) {
    return { ok: false, error: "honeypot" };
  }

  const reportingUnitId = fields.reportingUnitId.trim();
  const body = fields.body.trim();
  const businessAreaId = fields.businessAreaId.trim();
  const priority = fields.priority.trim();
  const parsedCategory = parsePublicReportCategory(fields.category);

  if (!reportingUnitId) {
    return { ok: false, error: "Välj varifrån rapporten kommer." };
  }
  const unit = allowedUnits.get(reportingUnitId);
  if (!unit) {
    return { ok: false, error: "Ogiltig rapportenhet." };
  }

  const haulierName = unit.name.trim();
  if (!haulierName) {
    return { ok: false, error: "Välj varifrån rapporten kommer." };
  }
  if (haulierName.length > OPERATIONAL_REPORT_HAULIER_MAX) {
    return {
      ok: false,
      error: `Namnet får vara högst ${OPERATIONAL_REPORT_HAULIER_MAX} tecken.`,
    };
  }
  if (!body) {
    return { ok: false, error: "Beskriv vad som har hänt." };
  }
  if (body.length > OPERATIONAL_REPORT_BODY_MAX) {
    return {
      ok: false,
      error: `Texten får vara högst ${OPERATIONAL_REPORT_BODY_MAX} tecken.`,
    };
  }
  if (!businessAreaId) {
    return { ok: false, error: "Välj affärsområde." };
  }
  if (!allowedAreaIds.has(businessAreaId)) {
    return { ok: false, error: "Ogiltigt affärsområde." };
  }
  if (!isOperationalReportPriority(priority)) {
    return { ok: false, error: "Välj prioritet." };
  }
  if (!parsedCategory) {
    return { ok: false, error: "Välj kategori." };
  }

  return {
    ok: true,
    value: {
      haulierName,
      businessAreaId,
      body,
      priority,
      category: parsedCategory.category,
      incidentKind: parsedCategory.incidentKind,
    },
  };
}
