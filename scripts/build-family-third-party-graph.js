import {
  buildFamilyThirdPartyGraphPlan,
  persistFamilyThirdPartyGraph,
} from "../src/family-third-party-graph.js";

const dryRun =
  process.argv.includes(
    "--dry-run",
  );

const plan =
  await buildFamilyThirdPartyGraphPlan();

console.log(
  dryRun
    ? "\n=== FAMILY + THIRD PARTY GRAPH DRY RUN ==="
    : "\n=== FAMILY + THIRD PARTY GRAPH PLAN ===",
);

console.table([
  plan.stats,
]);

console.log(
  "\nNode types:",
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
  "\nRelation types:",
);

console.table(
  Object.entries(
    plan.relations.reduce(
      (result, relation) => {
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
    await persistFamilyThirdPartyGraph(
      plan,
    );

  console.log(
    "\n=== GRAPH BUILD ===",
  );

  console.table([
    result.graph,
  ]);

  console.log(
    "\nIdentity resolution:",
  );

  console.table([
    result.resolutionStats,
  ]);

  console.log(
    "\nResolved edges:",
    result.resolvedRelations,
  );
}
