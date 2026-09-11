export const boardActionClusterClass =
  "relative z-10 flex shrink-0 items-center justify-end gap-1";

export const boardRowClass =
  "flex flex-wrap items-center justify-between gap-2";

export const boardCardPadClass = "px-4 py-1.5";

const boardControlHeightClass =
  "inline-flex h-7 shrink-0 items-center whitespace-nowrap px-2 text-xs";

const boardButtonClass =
  boardControlHeightClass +
  " relative z-10 appearance-none cursor-pointer transition-colors";

export const boardFieldClass =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800";

export const boardGhostButtonClass =
  boardButtonClass +
  " rounded-md bg-slate-100 font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-800";

export const boardPrimaryButtonClass =
  boardButtonClass +
  " rounded-md bg-[#0b1220] font-semibold text-white hover:bg-slate-800";

export const boardStartButtonClass =
  boardButtonClass +
  " ds-btn-start rounded-md bg-[#0369a1] font-semibold text-white hover:bg-[#075985]";

export const boardEscalateButtonClass =
  boardButtonClass +
  " ds-btn-escalate rounded-md bg-[#c2410c] font-semibold text-white hover:bg-[#9a3412]";

export const boardCompleteButtonClass =
  boardButtonClass +
  " ds-btn-done rounded-md bg-[#047857] font-semibold text-white hover:bg-[#065f46]";

export const boardCancelButtonClass =
  boardButtonClass +
  " rounded-md font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800";

export const boardStatusBadgeClass =
  boardControlHeightClass +
  " pointer-events-none rounded-md font-medium text-slate-600 ring-1 ring-inset ring-slate-200/80";

export const boardNewStatusBadgeClass =
  boardControlHeightClass +
  " pointer-events-none rounded-md border border-sky-200 bg-sky-50 font-medium text-sky-800";

export const boardInProgressStatusBadgeClass =
  boardControlHeightClass +
  " pointer-events-none rounded-md border border-amber-200 bg-amber-50 font-medium text-amber-900";

export const boardDoneStatusBadgeClass =
  boardControlHeightClass +
  " pointer-events-none rounded-md border border-emerald-200 bg-emerald-50 font-medium text-emerald-800";

export function boardReportStatusBadgeClass(status: string): string {
  if (status === "ny") {
    return boardNewStatusBadgeClass;
  }
  if (status === "klar") {
    return boardDoneStatusBadgeClass;
  }
  return boardStatusBadgeClass;
}

export function boardActivityStatusBadgeClass(label: string): string {
  if (label === "Pågår") {
    return boardInProgressStatusBadgeClass;
  }
  if (label === "Klar") {
    return boardDoneStatusBadgeClass;
  }
  return boardStatusBadgeClass;
}

export function boardNextStatusButtonClass(nextValue: string): string {
  return nextValue === "Klar"
    ? boardCompleteButtonClass
    : boardStartButtonClass;
}
