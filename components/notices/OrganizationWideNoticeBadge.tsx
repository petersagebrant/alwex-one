import { ORGANIZATION_WIDE_NOTICE_LABEL } from "@/lib/notices/organizationWide";

export function OrganizationWideNoticeBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-200/80">
      {ORGANIZATION_WIDE_NOTICE_LABEL}
    </span>
  );
}
