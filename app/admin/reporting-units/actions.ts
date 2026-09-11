"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserAdministrator } from "@/lib/auth/require-user";
import {
  createReportingUnit,
  setReportingUnitActive,
  updateReportingUnit,
} from "@/services/reportingUnits";

function reportingUnitsPath(query?: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  return search
    ? `/admin/reporting-units?${search}`
    : "/admin/reporting-units";
}

function fail(path: string, error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : fallback;
  redirect(
    `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`,
  );
}

function parseActive(formData: FormData): boolean {
  return String(formData.get("isActive") ?? "") === "1";
}

function parseDefaultArea(formData: FormData): string | null {
  const value = String(formData.get("defaultBusinessAreaId") ?? "").trim();
  return value || null;
}

function refreshPublicForm() {
  revalidatePath("/rapportera");
  revalidatePath("/admin/reporting-units");
}

export async function createReportingUnitAction(formData: FormData) {
  await requireUserAdministrator();

  try {
    await createReportingUnit({
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
      isActive: parseActive(formData),
      defaultBusinessAreaId: parseDefaultArea(formData),
    });
  } catch (error) {
    fail(
      reportingUnitsPath({ new: "1" }),
      error,
      "Kunde inte skapa rapportenheten.",
    );
  }

  refreshPublicForm();
  redirect(reportingUnitsPath({ message: "Rapportenheten skapad." }));
}

export async function updateReportingUnitAction(formData: FormData) {
  await requireUserAdministrator();
  const id = String(formData.get("id") ?? "");
  const editPath = reportingUnitsPath({ edit: id });

  try {
    await updateReportingUnit(id, {
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
      isActive: parseActive(formData),
      defaultBusinessAreaId: parseDefaultArea(formData),
    });
  } catch (error) {
    fail(editPath, error, "Kunde inte uppdatera rapportenheten.");
  }

  refreshPublicForm();
  redirect(reportingUnitsPath({ message: "Rapportenheten uppdaterad." }));
}

export async function setReportingUnitActiveAction(formData: FormData) {
  await requireUserAdministrator();
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("active") ?? "") === "1";

  try {
    await setReportingUnitActive(id, isActive);
  } catch (error) {
    fail(
      reportingUnitsPath(),
      error,
      isActive
        ? "Kunde inte återaktivera rapportenheten."
        : "Kunde inte inaktivera rapportenheten.",
    );
  }

  refreshPublicForm();
  redirect(
    reportingUnitsPath({
      message: isActive
        ? "Rapportenheten återaktiverad."
        : "Rapportenheten inaktiverad.",
    }),
  );
}
