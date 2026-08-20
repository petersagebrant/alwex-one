import { createClient } from "@/lib/supabase/server";

export type KpiCalcWeightedInputRow = {
  id: string;
  parent_kpi_id: string;
  numerator_kpi_id: string;
  denominator_kpi_id: string;
  sort_order: number;
};

export async function fetchWeightedInputsForParents(
  parentKpiIds: string[],
): Promise<KpiCalcWeightedInputRow[]> {
  if (parentKpiIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_calc_weighted_inputs")
    .select(
      "id, parent_kpi_id, numerator_kpi_id, denominator_kpi_id, sort_order",
    )
    .in("parent_kpi_id", parentKpiIds)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as KpiCalcWeightedInputRow[];
}
