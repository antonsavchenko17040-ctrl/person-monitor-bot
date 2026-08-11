import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_RECHECK_VERSION,
  buildEdrRecheckSignals,
  findSubjectsForEdrRecheck,
} from "../src/edr-recheck-planner.js";

function organization(
  edrpou,
) {
  return {
    record_type:
      "organization",
    edrpou,
  };
}

function observation({
  name =
    "іваненко іван іванович",
  edrpou =
    "12345678",
} = {}) {
  return {
    normalized_value:
      name,
    value_text:
      name,
    record_edrpou:
      edrpou,
  };
}

function fakeSql({
  subjects = [],
  links = [],
} = {}) {
  const calls = [];

  const sql =
    async (
      strings,
      ...values
    ) => {
      const text =
        strings.join("?");

      calls.push({
        text,
        values,
      });

      if (
        text.includes(
          "JOIN relations",
        )
      ) {
        return links;
      }

      if (
        text.includes(
          "FROM subjects",
        )
      ) {
        return subjects;
      }

      throw new Error(
        "Unexpected SQL",
      );
    };

  sql.calls =
    calls;

  return sql;
}

test(
  "exports recheck version",
  () => {
    assert.equal(
      EDR_RECHECK_VERSION,
      "edr-recheck-v1",
    );
  },
);

test(
  "collects changed organization and relation signals",
  () => {
    const result =
      buildEdrRecheckSignals({
        recordComparison: {
          organizations: {
            changed: [
              {
                old_record:
                  organization(
                    "12345678",
                  ),

                new_record:
                  organization(
                    "12345678",
                  ),
              },
            ],
          },
        },

        relationComparison: {
          added: [
            {
              observations: [
                observation(),
              ],
            },
          ],

          removed: [],
        },
      });

    assert.equal(
      result.organizations.length,
      1,
    );

    assert.equal(
      result.organizations[0]
        .edrpou,
      "12345678",
    );

    assert.deepEqual(
      result.organizations[0]
        .reasons,
      [
        "organization_changed",
        "relation_added",
      ],
    );

    assert.equal(
      result.names[0]
        .normalized_name,
      "іваненко іван іванович",
    );
  },
);

test(
  "matches changed relation to exact subject full name",
  async () => {
    const sql =
      fakeSql({
        subjects: [
          {
            id: "s1",
            entity_id: "e1",
            full_name:
              "Іваненко Іван Іванович",
            aliases: [],
          },
        ],
      });

    const result =
      await findSubjectsForEdrRecheck(
        sql,
        {
          relationComparison: {
            added: [
              {
                observations: [
                  observation(),
                ],
              },
            ],
          },
        },
      );

    assert.equal(
      result.summary.subjects,
      1,
    );

    assert.ok(
      result.subjects[0]
        .reasons.includes(
          "exact_subject_name_match",
        ),
    );
  },
);

test(
  "matches exact subject alias",
  async () => {
    const sql =
      fakeSql({
        subjects: [
          {
            id: "s1",
            entity_id: "e1",
            full_name:
              "Іваненко Іван Петрович",
            aliases: [
              "Іваненко Іван Іванович",
            ],
          },
        ],
      });

    const result =
      await findSubjectsForEdrRecheck(
        sql,
        {
          relationComparison: {
            removed: [
              {
                observations: [
                  observation(),
                ],
              },
            ],
          },
        },
      );

    assert.equal(
      result.summary.subjects,
      1,
    );

    assert.deepEqual(
      result.subjects[0]
        .matched_names,
      [
        "іваненко іван іванович",
      ],
    );
  },
);

test(
  "does not fuzzy match a similar name",
  async () => {
    const sql =
      fakeSql({
        subjects: [
          {
            id: "s1",
            entity_id: "e1",
            full_name:
              "Іваненко Ігор Іванович",
            aliases: [],
          },
        ],
      });

    const result =
      await findSubjectsForEdrRecheck(
        sql,
        {
          relationComparison: {
            added: [
              {
                observations: [
                  observation(),
                ],
              },
            ],
          },
        },
      );

    assert.equal(
      result.summary.subjects,
      0,
    );
  },
);

test(
  "rechecks subject already linked to changed EDR organization",
  async () => {
    const sql =
      fakeSql({
        subjects: [
          {
            id: "s1",
            entity_id: "e1",
            full_name:
              "Петренко Петро Петрович",
            aliases: [],
          },
        ],

        links: [
          {
            subject_id:
              "s1",
            subject_entity_id:
              "e1",
            edrpou:
              "12345678",
          },
        ],
      });

    const result =
      await findSubjectsForEdrRecheck(
        sql,
        {
          recordComparison: {
            organizations: {
              changed: [
                {
                  old_record:
                    organization(
                      "12345678",
                    ),

                  new_record:
                    organization(
                      "12345678",
                    ),
                },
              ],
            },
          },
        },
      );

    assert.equal(
      result.summary.subjects,
      1,
    );

    assert.ok(
      result.subjects[0]
        .reasons.includes(
          "existing_edr_graph_link",
        ),
    );

    assert.deepEqual(
      result.subjects[0]
        .matched_edrpous,
      ["12345678"],
    );
  },
);

test(
  "deduplicates subject reached by name and graph link",
  async () => {
    const sql =
      fakeSql({
        subjects: [
          {
            id: "s1",
            entity_id: "e1",
            full_name:
              "Іваненко Іван Іванович",
            aliases: [],
          },
        ],

        links: [
          {
            subject_id:
              "s1",
            subject_entity_id:
              "e1",
            edrpou:
              "12345678",
          },
        ],
      });

    const result =
      await findSubjectsForEdrRecheck(
        sql,
        {
          recordComparison: {
            organizations: {
              changed: [
                {
                  old_record:
                    organization(
                      "12345678",
                    ),

                  new_record:
                    organization(
                      "12345678",
                    ),
                },
              ],
            },
          },

          relationComparison: {
            added: [
              {
                observations: [
                  observation(),
                ],
              },
            ],
          },
        },
      );

    assert.equal(
      result.summary.subjects,
      1,
    );

    assert.ok(
      result.subjects[0]
        .reasons.includes(
          "exact_subject_name_match",
        ),
    );

    assert.ok(
      result.subjects[0]
        .reasons.includes(
          "existing_edr_graph_link",
        ),
    );
  },
);

test(
  "no changes returns no subjects without database queries",
  async () => {
    const sql =
      fakeSql();

    const result =
      await findSubjectsForEdrRecheck(
        sql,
        {},
      );

    assert.equal(
      result.summary.subjects,
      0,
    );

    assert.equal(
      sql.calls.length,
      0,
    );
  },
);
