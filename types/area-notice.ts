export const AREA_NOTICE_KINDS = [
  "Information",
  "Behov",
  "Viktigt",
  "Driftstörning",
] as const;

export type AreaNoticeKind = (typeof AREA_NOTICE_KINDS)[number];

export type AreaNotice = {
  id: string;
  businessAreaId: string;
  kind: AreaNoticeKind;
  title: string;
  body: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdByName: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
  endsOn: string | null;
  archivedAt: string | null;
};

export type CreateAreaNoticeInput = {
  businessAreaId: string;
  kind: AreaNoticeKind;
  title: string;
  body: string;
  endsOn?: string | null;
};

export type UpdateAreaNoticeInput = {
  id: string;
  businessAreaId: string;
  kind: AreaNoticeKind;
  title: string;
  body: string;
  endsOn?: string | null;
};
