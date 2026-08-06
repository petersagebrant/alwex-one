export type UiStatus = "Grön" | "Gul" | "Röd" | "Grå" | "Blå";

export type UiTrend = "Upp" | "Oförändrad" | "Ner" | string;

export type InfoPanelVariant =
  | "vd-comment"
  | "info"
  | "warning"
  | "ai-summary";

export const uiStatusDotClass: Record<UiStatus, string> = {
  Grön: "bg-emerald-500",
  Gul: "bg-amber-400",
  Röd: "bg-rose-500",
  Grå: "bg-slate-400",
  Blå: "bg-sky-500",
};

export const uiStatusBadgeClass: Record<UiStatus, string> = {
  Grön: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  Gul: "bg-amber-50 text-amber-900 ring-amber-200/80",
  Röd: "bg-rose-50 text-rose-800 ring-rose-200/80",
  Grå: "bg-slate-50 text-slate-700 ring-slate-200/80",
  Blå: "bg-sky-50 text-sky-800 ring-sky-200/80",
};
