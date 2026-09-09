import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVdAreaOverviewRows } from "./vdAreaOverview";
import type { VdAreaOverviewKpi } from "./vdAreaOverview";

function kpi(
  partial: Partial<VdAreaOverviewKpi> &
    Pick<VdAreaOverviewKpi, "id" | "businessAreaId" | "status">,
): VdAreaOverviewKpi {
  return {
    kind: "TARGET",
    currentValue: "10",
    targetValue: "10",
    name: partial.name ?? partial.id,
    ...partial,
  };
}

describe("buildVdAreaOverviewRows", () => {
  const kyl = {
    id: "kyl",
    name: "Kyl & Frys",
    slug: "kyl-frys",
    manager: "Anna",
  };
  const lager = {
    id: "lager",
    name: "Lager & Logistik",
    slug: "lager-logistik",
    manager: "Bo",
  };
  const totalt = {
    id: "totalt",
    name: "Alwex totalt",
    slug: "alwex-totalt",
    manager: "VD",
  };

  it("uses computeAreaOperationalStatus and selectKeyKpis for the reddest exception", () => {
    const rows = buildVdAreaOverviewRows(
      [kyl, lager],
      [
        kpi({
          id: "sjuk",
          businessAreaId: "kyl",
          name: "Sjukfrånvaro",
          status: "Gul",
          currentValue: "8",
          targetValue: "4",
        }),
        kpi({
          id: "fyllnad",
          businessAreaId: "kyl",
          name: "Fyllnadsgrad",
          status: "Röd",
          currentValue: "50",
          targetValue: "90",
        }),
        kpi({
          id: "kolli",
          businessAreaId: "lager",
          name: "Kolli per arbetad timme",
          status: "Grön",
          currentValue: "110",
          targetValue: "100",
        }),
      ],
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, "Kyl & Frys");
    assert.equal(rows[0].status, "Röd");
    assert.equal(rows[0].statusLabel, "Röd");
    assert.equal(rows[0].keyDeviation, "Fyllnadsgrad");
    assert.equal(rows[0].manager, "Anna");
    assert.equal(rows[0].href, "/areas/kyl-frys");

    assert.equal(rows[1].name, "Lager & Logistik");
    assert.equal(rows[1].status, "Grön");
    assert.equal(rows[1].keyDeviation, "Inga väsentliga avvikelser");
  });

  it("labels unreported AO as Ej rapporterat without inventing a KPI exception", () => {
    const rows = buildVdAreaOverviewRows(
      [lager],
      [
        kpi({
          id: "missing",
          businessAreaId: "lager",
          name: "Kolli per arbetad timme",
          status: "Gul",
          currentValue: null,
          targetValue: "100",
        }),
      ],
    );

    assert.equal(rows[0].status, null);
    assert.equal(rows[0].statusLabel, "Ej rapporterat");
    assert.equal(rows[0].keyDeviation, "Ingen rapporterad avvikelse");
  });

  it("excludes Alwex totalt and sorts Röd before Gul before unreported before Grön", () => {
    const mark = {
      id: "mark",
      name: "Mark",
      slug: "mark",
      manager: "Carl",
    };
    const recycling = {
      id: "aterv",
      name: "Återvinning",
      slug: "atervinning",
      manager: "Dana",
    };
    const rows = buildVdAreaOverviewRows(
      [lager, totalt, kyl, mark, recycling],
      [
        kpi({
          id: "green",
          businessAreaId: "lager",
          status: "Grön",
          currentValue: "1",
        }),
        kpi({
          id: "red",
          businessAreaId: "kyl",
          status: "Röd",
          currentValue: "1",
        }),
        kpi({
          id: "yellow",
          businessAreaId: "mark",
          status: "Gul",
          currentValue: "1",
        }),
      ],
    );

    assert.deepEqual(
      rows.map((row) => row.slug),
      ["kyl-frys", "mark", "atervinning", "lager-logistik"],
    );
    assert.equal(
      rows.some((row) => row.slug === "alwex-totalt"),
      false,
    );
  });
});
