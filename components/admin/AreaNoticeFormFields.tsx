"use client";

import {
  AREA_NOTICE_BODY_MAX,
  AREA_NOTICE_KINDS,
  AREA_NOTICE_KIND_LABELS,
  AREA_NOTICE_TITLE_MAX,
} from "@/lib/notices/kind";
import type { AreaNoticeListItem } from "@/services/areaNotices";

type AreaOption = { id: string; name: string };

type AreaNoticeFormFieldsProps = {
  areas: AreaOption[];
  notice?: AreaNoticeListItem | null;
  lockedAreaId?: string | null;
};

const fieldClassName =
  "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20";

export function AreaNoticeFormFields({
  areas,
  notice,
  lockedAreaId,
}: AreaNoticeFormFieldsProps) {
  const selectedAreaId = lockedAreaId || notice?.businessAreaId || "";

  return (
    <>
      <div>
        <label
          htmlFor="kind"
          className="block text-xs font-medium text-neutral-500"
        >
          Typ
        </label>
        <select
          id="kind"
          name="kind"
          required
          defaultValue={notice?.kind ?? "Information"}
          className={fieldClassName}
        >
          {AREA_NOTICE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {AREA_NOTICE_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="businessAreaId"
          className="block text-xs font-medium text-neutral-500"
        >
          Affärsområde
        </label>
        {lockedAreaId ? (
          <>
            <input
              type="hidden"
              id="businessAreaId"
              name="businessAreaId"
              value={lockedAreaId}
            />
            <p className="mt-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
              {areas.find((area) => area.id === lockedAreaId)?.name ??
                notice?.businessAreaName ??
                "Valt affärsområde"}
            </p>
          </>
        ) : (
          <select
            id="businessAreaId"
            name="businessAreaId"
            required
            defaultValue={selectedAreaId}
            className={fieldClassName}
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
        )}
      </div>

      <div>
        <label
          htmlFor="title"
          className="block text-xs font-medium text-neutral-500"
        >
          Titel
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={AREA_NOTICE_TITLE_MAX}
          defaultValue={notice?.title ?? ""}
          className={fieldClassName}
        />
      </div>

      <div>
        <label
          htmlFor="body"
          className="block text-xs font-medium text-neutral-500"
        >
          Text
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={4}
          maxLength={AREA_NOTICE_BODY_MAX}
          defaultValue={notice?.body ?? ""}
          className={fieldClassName}
        />
      </div>

      <div>
        <label
          htmlFor="endsOn"
          className="block text-xs font-medium text-neutral-500"
        >
          Gäller till (valfritt)
        </label>
        <input
          id="endsOn"
          name="endsOn"
          type="date"
          defaultValue={notice?.endsOn ?? ""}
          className={fieldClassName}
        />
        <p className="mt-1.5 text-xs text-neutral-500">
          Tomt = visas tills inlägget arkiveras.
        </p>
      </div>
    </>
  );
}
