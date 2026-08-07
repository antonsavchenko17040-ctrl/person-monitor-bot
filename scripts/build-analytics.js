import {
  buildAllAnalytics,
  persistAnalyticsCrossChecks,
} from "../src/analytics.js";

const dryRun =
  process.argv.includes("--dry-run");

const analytics =
  await buildAllAnalytics();

const totals = {
  entities: analytics.length,
  years: 0,
  transitions: 0,
  findings: 0,
  inserted: 0,
  updated: 0,
};

for (const entity of analytics) {
  totals.years +=
    entity.yearly.length;

  totals.transitions +=
    entity.transitions.length;

  totals.findings +=
    entity.transitions.reduce(
      (sum, item) =>
        sum +
        item.findings.length,
      0,
    );

  console.log(
    `\n=== ${entity.canonicalName} ===`,
  );

  console.table(
    entity.yearly.map(
      (year) => ({
        year:
          year.year,

        income_uah:
          year.incomeDeclarantUah,

        cash_uah:
          year
            .cashDeclarantByCurrency
            ?.UAH ?? 0,

        real_estate:
          year
            .realEstateDeclarantRelated,

        vehicles:
          year
            .vehiclesDeclarantRelated,

        family:
          year.familyMembers,

        workplace:
          year.employment
            ?.workplace ?? "",

        position:
          year.employment
            ?.position ?? "",
      }),
    ),
  );

  console.table(
    entity.transitions.map(
      (item) => ({
        from:
          item.fromYear,

        to:
          item.toYear,

        income_delta:
          item.incomeDelta,

        income_delta_pct:
          item.incomeDeltaPercent,

        cash_uah_delta:
          item.cashUahDelta,

        real_estate_delta:
          item.realEstateDelta,

        vehicle_delta:
          item.vehicleDelta,

        findings:
          item.findings.length,
      }),
    ),
  );

  if (!dryRun) {
    const result =
      await persistAnalyticsCrossChecks(
        entity,
      );

    totals.inserted +=
      result.inserted;

    totals.updated +=
      result.updated;
  }
}

console.log(
  dryRun
    ? "\n=== ANALYTICS DRY RUN ==="
    : "\n=== ANALYTICS BUILD ===",
);

console.table([totals]);
