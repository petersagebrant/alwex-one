import type { StatusTone } from "@/types";

export const statusDotClass: Record<StatusTone, string> = {
  Grön: "bg-emerald-500",
  Gul: "bg-amber-400",
  Röd: "bg-rose-500",
};

export const statusBadgeClass: Record<StatusTone, string> = {
  Grön: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Gul: "bg-amber-50 text-amber-800 ring-amber-600/15",
  Röd: "bg-rose-50 text-rose-700 ring-rose-600/15",
};
