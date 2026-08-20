"use server";

import { redirect } from "next/navigation";
import { requireOperationalWriter } from "@/lib/auth/require-user";
import {
  isKpiStoredStatus,
  parseKpiKind,
  STATISTIC_STATUS,
} from "@/lib/kpi/kind";
import { fetchKpiById } from "@/lib/supabase/kpis";
import { addKPIHistoryEntry } from "@/services/kpiHistory";

export async function addKpiHistoryAction(formData: FormData) {
  await requireOperationalWriter();
  const kpiId = String(formData.get("kpiId") ?? "").trim();
  const value = String(formData.get("value") ?? "");
  const statusValue = String(formData.get("status") ?? "");
  const comment = String(formData.get("comment") ?? "");
  const recordedAt = String(formData.get("recordedAt") ?? "");

  if (!kpiId) {
    redirect("/admin/kpis?error=Saknar%20KPI-id.");
  }

  if (!value.trim()) {
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent("Värde är obligatoriskt.")}`,
    );
  }

  const kpi = await fetchKpiById(kpiId).catch(() => null);
  if (!kpi) {
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent("KPI hittades inte.")}`,
    );
  }

  const kind = parseKpiKind(kpi.kpi_kind);
  if (kind === "CALCULATED" || kpi.calc_operator) {
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent("Beräknade KPI:er får endast uppdateras via indata.")}`,
    );
  }

  const status =
    kind === "STATISTIC"
      ? STATISTIC_STATUS
      : isKpiStoredStatus(statusValue) && statusValue !== STATISTIC_STATUS
        ? statusValue
        : null;

  if (!status) {
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent("Ogiltig status.")}`,
    );
  }

  if (!recordedAt.trim()) {
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent("Datum är obligatoriskt.")}`,
    );
  }

  try {
    await addKPIHistoryEntry({
      kpiId,
      value,
      status,
      comment,
      recordedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Kunde inte spara historikvärde.";
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent(message)}`,
    );
  }

  redirect(`/admin/kpis/${encodeURIComponent(kpiId)}`);
}
