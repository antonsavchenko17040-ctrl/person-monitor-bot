import test from "node:test";
import assert from "node:assert/strict";

import {
  SUBJECT_SEARCH_PLAN_VERSION,
  DEFAULT_SEARCH_TOPICS,
  buildSubjectSearchPlan,
} from "../src/subject-search-plan.js";

function subject(overrides = {}) {
  return {
    full_name:
      "Савченко Антон Віталійович",

    aliases: [
      "Антон Савченко",
      "Anton Savchenko",
    ],

    organization:
      "Національне агентство з питань запобігання корупції",

    position:
      "головний спеціаліст Відділу цифрової трансформації та інноваційного розвитку",

    city:
      "Київ",

    ...overrides,
  };
}

test(
  "exports search plan version",
  () => {
    assert.equal(
      SUBJECT_SEARCH_PLAN_VERSION,
      "subject-search-plan-v1",
    );

    assert.ok(
      DEFAULT_SEARCH_TOPICS
        .includes("суд"),
    );
  },
);

test(
  "creates exact queries for full name and aliases",
  () => {
    const plan =
      buildSubjectSearchPlan(
        subject(),
      );

    const exact =
      plan.queries.filter(
        (item) =>
          item.kind ===
          "exact_name",
      );

    assert.deepEqual(
      exact.map(
        (item) =>
          item.query,
      ),
      [
        "\"Савченко Антон Віталійович\"",
        "\"Антон Савченко\"",
        "\"Anton Savchenko\"",
      ],
    );

    assert.equal(
      plan.stats.names,
      3,
    );
  },
);

test(
  "creates organization position and city context queries",
  () => {
    const plan =
      buildSubjectSearchPlan(
        subject(),
        {
          topics: [],
        },
      );

    const kinds =
      new Set(
        plan.queries.map(
          (item) =>
            item.kind,
        ),
      );

    assert.ok(
      kinds.has(
        "name_organization",
      ),
    );

    assert.ok(
      kinds.has(
        "name_position",
      ),
    );

    assert.ok(
      kinds.has(
        "name_city",
      ),
    );

    assert.equal(
      plan.stats.contextual,
      3,
    );
  },
);

test(
  "creates topical searches for the primary full name",
  () => {
    const plan =
      buildSubjectSearchPlan(
        subject(),
        {
          topics: [
            "суд",
            "компанія",
          ],
        },
      );

    const topical =
      plan.queries.filter(
        (item) =>
          item.kind ===
          "name_topic",
      );

    assert.deepEqual(
      topical.map(
        (item) =>
          item.query,
      ),
      [
        "\"Савченко Антон Віталійович\" суд",
        "\"Савченко Антон Віталійович\" компанія",
      ],
    );

    assert.equal(
      plan.stats.topical,
      2,
    );
  },
);

test(
  "deduplicates duplicate names and topics",
  () => {
    const plan =
      buildSubjectSearchPlan(
        subject({
          aliases: [
            "Савченко Антон Віталійович",
            "Anton Savchenko",
            "Anton Savchenko",
          ],
        }),
        {
          topics: [
            "суд",
            "суд",
          ],
        },
      );

    const queries =
      plan.queries.map(
        (item) =>
          item.query,
      );

    assert.equal(
      queries.length,
      new Set(
        queries,
      ).size,
    );

    assert.equal(
      queries.filter(
        (query) =>
          query.endsWith(
            " суд",
          ),
      ).length,
      1,
    );
  },
);

test(
  "respects maximum query limit and keeps highest priority first",
  () => {
    const plan =
      buildSubjectSearchPlan(
        subject(),
        {
          maxQueries: 4,

          topics: [
            "суд",
            "компанія",
            "закупівлі",
          ],
        },
      );

    assert.equal(
      plan.queries.length,
      4,
    );

    assert.equal(
      plan.queries[0].kind,
      "exact_name",
    );

    for (
      let index = 1;
      index <
        plan.queries.length;
      index += 1
    ) {
      assert.ok(
        plan.queries[index - 1]
          .priority >=
        plan.queries[index]
          .priority,
      );
    }
  },
);

test(
  "returns empty plan when subject has no names",
  () => {
    const plan =
      buildSubjectSearchPlan({
        full_name: "",
        aliases: [],
      });

    assert.deepEqual(
      plan.queries,
      [],
    );

    assert.equal(
      plan.stats.names,
      0,
    );

    assert.equal(
      plan.stats.queries,
      0,
    );
  },
);
