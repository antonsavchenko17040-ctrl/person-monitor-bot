import {
  buildIncomeSourceGraphPlan,
  persistIncomeSourceGraph,
} from "../src/income-source-graph.js";

const dryRun =
  process.argv.includes(
    "--dry-run",
  );

const plan =
  await buildIncomeSourceGraphPlan();

console.log(
  dryRun
    ? "\n=== INCOME SOURCE GRAPH DRY RUN ==="
    : "\n=== INCOME SOURCE GRAPH PLAN ===",
);

console.table([
  plan.stats,
]);

if (!dryRun) {
  const result =
    await persistIncomeSourceGraph(
      plan,
    );

  console.log(
    "\n=== INCOME SOURCE GRAPH BUILD ===",
  );

  console.table([
    {
      nodesInserted:
        result.nodesInserted,

      nodesUpdated:
        result.nodesUpdated,

      identifiersInserted:
        result.identifiersInserted,

      relationsInserted:
        result.relationsInserted,

      relationsUpdated:
        result.relationsUpdated,
    },
  ]);

  console.log(
    "\nPerson observations:",
  );

  console.table([
    result.observations,
  ]);
}
