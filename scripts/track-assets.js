import {
  buildAllAssetTimelines,
  persistAssetEvents,
} from "../src/asset-tracking.js";

const dryRun =
  process.argv.includes("--dry-run");

const timelines =
  await buildAllAssetTimelines();

const totals = {
  entities: 0,
  transitions: 0,

  retained: 0,
  appeared: 0,
  disappeared: 0,
  uncertain: 0,

  inserted: 0,
  updated: 0,
};

for (const timeline of timelines) {
  totals.entities += 1;

  console.log(
    `\n=== ${timeline.canonicalName} ===`,
  );

  console.log(
    "\nAssets by year:",
  );

  console.table(
    timeline.yearly,
  );

  console.log(
    "\nCareer timeline:",
  );

  console.table(
    timeline.career,
  );

  const rows = [];

  for (
    const transition
    of timeline.transitions
  ) {
    const retained =
      transition
        .realEstate
        .retained.length +
      transition
        .vehicles
        .retained.length;

    const appeared =
      transition
        .realEstate
        .appeared.length +
      transition
        .vehicles
        .appeared.length;

    const disappeared =
      transition
        .realEstate
        .disappeared.length +
      transition
        .vehicles
        .disappeared.length;

    const uncertain =
      transition
        .realEstate
        .uncertain.length +
      transition
        .vehicles
        .uncertain.length;

    totals.transitions += 1;
    totals.retained += retained;
    totals.appeared += appeared;
    totals.disappeared +=
      disappeared;
    totals.uncertain += uncertain;

    rows.push({
      from:
        transition.fromYear,

      to:
        transition.toYear,

      gap:
        transition.yearGap,

      retained,
      appeared,
      disappeared,
      uncertain,
    });
  }

  console.log(
    "\nAsset transitions:",
  );

  console.table(rows);

  if (!dryRun) {
    const result =
      await persistAssetEvents(
        timeline,
      );

    totals.inserted +=
      result.inserted;

    totals.updated +=
      result.updated;
  }
}

console.log(
  dryRun
    ? "\n=== ASSET TRACKING DRY RUN ==="
    : "\n=== ASSET TRACKING BUILD ===",
);

console.table([totals]);
