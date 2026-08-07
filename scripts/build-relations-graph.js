import {
  buildRelationsGraphPlan,
  persistRelationsGraph,
} from "../src/graph-builder.js";

const dryRun =
  process.argv.includes(
    "--dry-run",
  );

const plan =
  await buildRelationsGraphPlan();

console.log(
  dryRun
    ? "\n=== RELATIONS GRAPH DRY RUN ==="
    : "\n=== RELATIONS GRAPH PLAN ===",
);

console.table([
  plan.stats,
]);

console.log(
  "\nNodes:",
);

console.table(
  Object.entries(
    plan.nodes.reduce(
      (result, node) => {
        result[
          node.entityType
        ] =
          (
            result[
              node.entityType
            ] ?? 0
          ) + 1;

        return result;
      },
      {},
    ),
  ).map(
    ([type, total]) => ({
      type,
      total,
    }),
  ),
);

console.log(
  "\nRelations:",
);

console.table(
  Object.entries(
    plan.relations.reduce(
      (
        result,
        relation,
      ) => {
        result[
          relation
            .relationType
        ] =
          (
            result[
              relation
                .relationType
            ] ?? 0
          ) + 1;

        return result;
      },
      {},
    ),
  ).map(
    ([type, total]) => ({
      type,
      total,
    }),
  ),
);

if (!dryRun) {
  const result =
    await persistRelationsGraph(
      plan,
    );

  console.log(
    "\n=== RELATIONS GRAPH BUILD ===",
  );

  console.table([
    result,
  ]);
}
