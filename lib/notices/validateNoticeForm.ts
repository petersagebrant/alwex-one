import {
  AREA_NOTICE_BODY_MAX,
  AREA_NOTICE_TITLE_MAX,
  isAreaNoticeKind,
  type AreaNoticeKind,
} from "@/lib/notices/kind";
import { parseIsoCalendarDate } from "@/lib/kpi/dailyReportDate";

export type AreaNoticeFormValues = {
  businessAreaId: string;
  kind: string;
  title: string;
  body: string;
  endsOn: string;
};

export type ParsedAreaNoticeForm = {
  businessAreaId: string;
  kind: AreaNoticeKind;
  title: string;
  body: string;
  endsOn: string | null;
};

export type ParseAreaNoticeFormResult =
  | { ok: true; value: ParsedAreaNoticeForm }
  | { ok: false; error: string };

export function parseAreaNoticeFormValues(
  input: AreaNoticeFormValues,
): ParseAreaNoticeFormResult {
  const businessAreaId = input.businessAreaId.trim();
  if (!businessAreaId) {
    return { ok: false, error: "Välj ett affärsområde." };
  }

  const kindRaw = input.kind.trim();
  if (!isAreaNoticeKind(kindRaw)) {
    return { ok: false, error: "Ogiltig typ för Aktuellt." };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "Titel är obligatorisk." };
  }
  if (title.length > AREA_NOTICE_TITLE_MAX) {
    return {
      ok: false,
      error: `Titel får vara högst ${AREA_NOTICE_TITLE_MAX} tecken.`,
    };
  }

  const body = input.body.trim();
  if (!body) {
    return { ok: false, error: "Text är obligatorisk." };
  }
  if (body.length > AREA_NOTICE_BODY_MAX) {
    return {
      ok: false,
      error: `Text får vara högst ${AREA_NOTICE_BODY_MAX} tecken.`,
    };
  }

  const endsRaw = input.endsOn.trim();
  let endsOn: string | null = null;
  if (endsRaw) {
    const parsed = parseIsoCalendarDate(endsRaw);
    if (!parsed) {
      return { ok: false, error: "Ogiltigt slutdatum." };
    }
    endsOn = parsed;
  }

  return {
    ok: true,
    value: {
      businessAreaId,
      kind: kindRaw,
      title,
      body,
      endsOn,
    },
  };
}
