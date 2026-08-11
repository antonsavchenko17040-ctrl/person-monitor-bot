import test from "node:test";
import assert from "node:assert/strict";

import {
  CORRUPTION_SEARCH_PLAN_VERSION,
  buildCorruptionSearchPlan,
} from "../src/corruption-search-plan.js";

function subject() {
  return {
    full_name:
      "Савченко Антон Віталійович",

    aliases: [
      "Антон Савченко",
      "Anton Savchenko",
    ],
  };
}

test(
  "exports corruption search plan version",
  () => {
    assert.equal(
      CORRUPTION_SEARCH_PLAN_VERSION,
      "corruption-search-plan-v1",
    );
  },
);

test(
  "creates four corruption-only queries",
  () => {
    const plan =
      buildCorruptionSearchPlan(
        subject(),
      );

    assert.equal(
      plan.queries.length,
      4,
    );

    assert.ok(
      plan.queries.every(
        (item) =>
          item.query.includes(
            "\"Савченко Антон Віталійович\"",
          ),
      ),
    );

    assert.ok(
      plan.queries.every(
        (item) =>
          item.context ===
          "corruption",
      ),
    );
  },
);

test(
  "never creates plain name-only query",
  () => {
    const plan =
      buildCorruptionSearchPlan(
        subject(),
      );

    assert.equal(
      plan.queries.some(
        (item) =>
          item.query.trim() ===
          "\"Савченко Антон Віталійович\"",
      ),
      false,
    );
  },
);

test(
  "includes direct and enforcement corruption contexts",
  () => {
    const plan =
      buildCorruptionSearchPlan(
        subject(),
      );

    const text =
      plan.queries
        .map(
          (item) =>
            item.query,
        )
        .join(" ");

    assert.match(
      text,
      /корупція/,
    );

    assert.match(
      text,
      /неправомірна вигода/,
    );

    assert.match(
      text,
      /НАБУ/,
    );

    assert.match(
      text,
      /незаконне збагачення/,
    );
  },
);

test(
  "respects maximum query limit",
  () => {
    const plan =
      buildCorruptionSearchPlan(
        subject(),
        {
          maxQueries: 2,
        },
      );

    assert.equal(
      plan.queries.length,
      2,
    );

    assert.ok(
      plan.queries[0]
        .priority >=
      plan.queries[1]
        .priority,
    );
  },
);

test(
  "returns empty plan without subject name",
  () => {
    const plan =
      buildCorruptionSearchPlan({
        full_name: "",
        aliases: [],
      });

    assert.deepEqual(
      plan.queries,
      [],
    );
  },
);
