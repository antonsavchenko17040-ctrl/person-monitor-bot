import test from "node:test";
import assert from "node:assert/strict";


test(
  "loads timeless EDR subject relations without declaration year",
  async () => {
    const {
      loadTimelessEdrRelations,
      TIMELESS_EDR_RELATION_TYPES,
    } =
      await import(
        "../src/report-timeless-relations.js"
      );

    assert.deepEqual(
      TIMELESS_EDR_RELATION_TYPES,
      [
        "edr_founder_of",
        "edr_beneficiary_of",
        "edr_signer_of",
        "edr_member_of",
        "edr_executive_power_of",
        "edr_superior_management_of",
      ],
    );

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

        return [{
          relation_id:
            "relation-edr-1",

          relation_type:
            "edr_founder_of",

          source_document_id:
            null,

          valid_from:
            null,

          valid_to:
            null,

          confidence:
            70,

          verification_status:
            "manual_review",

          relation_metadata: {
            source:
              "edr",

            edr_relation_type:
              "founder",

            review_required:
              true,
          },

          from_entity_id:
            "subject-entity-1",

          from_entity_type:
            "person",

          from_name:
            "Тестовий Суб’єкт",

          from_metadata: {},

          to_entity_id:
            "organization-1",

          to_entity_type:
            "organization",

          to_name:
            "Тестова Організація",

          to_metadata: {
            edrpou:
              "12345678",
          },
        }];
      };

    const items =
      await loadTimelessEdrRelations(
        "subject-entity-1",
        {
          sql,
        },
      );

    assert.equal(
      calls.length,
      1,
    );

    assert.match(
      calls[0].text,
      /valid_from\s+IS\s+NULL/i,
    );

    assert.match(
      calls[0].text,
      /relation_type/i,
    );

    assert.match(
      calls[0].text,
      /metadata/i,
    );

    assert.deepEqual(
      items,
      [{
        relation_id:
          "relation-edr-1",

        relation_type:
          "edr_founder_of",

        relation_scope:
          "timeless",

        source_document_id:
          null,

        valid_from:
          null,

        valid_to:
          null,

        confidence:
          70,

        verification_status:
          "manual_review",

        metadata: {
          source:
            "edr",

          edr_relation_type:
            "founder",

          review_required:
            true,
        },

        from_entity_id:
          "subject-entity-1",

        from_entity_type:
          "person",

        from_name:
          "Тестовий Суб’єкт",

        from_metadata: {},

        to_entity_id:
          "organization-1",

        to_entity_type:
          "organization",

        to_name:
          "Тестова Організація",

        to_metadata: {
          edrpou:
            "12345678",
        },
      }],
    );
  },
);


test(
  "timeless EDR loader rejects empty subject without database access",
  async () => {
    const {
      loadTimelessEdrRelations,
    } =
      await import(
        "../src/report-timeless-relations.js"
      );

    let called = false;

    const result =
      await loadTimelessEdrRelations(
        "",
        {
          sql: async () => {
            called = true;
            return [];
          },
        },
      );

    assert.deepEqual(
      result,
      [],
    );

    assert.equal(
      called,
      false,
    );
  },
);



test(
  "timeless EDR loader defensively rejects rows outside subject organization contract",
  async () => {
    const {
      loadTimelessEdrRelations,
    } =
      await import(
        "../src/report-timeless-relations.js"
      );

    const baseRow = {
      relation_id:
        "relation-valid",

      relation_type:
        "edr_founder_of",

      source_document_id:
        null,

      valid_from:
        null,

      valid_to:
        null,

      confidence:
        70,

      verification_status:
        "manual_review",

      relation_metadata: {
        source:
          "edr",

        review_required:
          true,
      },

      from_entity_id:
        "subject-entity-1",

      from_entity_type:
        "person",

      from_name:
        "Суб’єкт",

      from_metadata: {},

      to_entity_id:
        "organization-1",

      to_entity_type:
        "organization",

      to_name:
        "Організація",

      to_metadata: {
        edrpou:
          "12345678",
      },
    };

    const rows = [
      baseRow,

      {
        ...baseRow,

        relation_id:
          "relation-wrong-subject",

        from_entity_id:
          "other-subject",
      },

      {
        ...baseRow,

        relation_id:
          "relation-wrong-target",

        to_entity_id:
          "person-1",

        to_entity_type:
          "person",
      },

      {
        ...baseRow,

        relation_id:
          "relation-wrong-source",

        relation_metadata: {
          source:
            "nazk",
        },
      },

      {
        ...baseRow,

        relation_id:
          "relation-dated",

        valid_from:
          "2025-01-01",
      },

      {
        ...baseRow,

        relation_id:
          "relation-unsupported",

        relation_type:
          "employed_by",
      },
    ];

    const items =
      await loadTimelessEdrRelations(
        "subject-entity-1",
        {
          sql: async () =>
            rows,
        },
      );

    assert.deepEqual(
      items.map(
        (item) =>
          item.relation_id,
      ),
      [
        "relation-valid",
      ],
    );
  },
);



test(
  "timeless EDR loader never emits blank canonical identifiers",
  async () => {
    const {
      loadTimelessEdrRelations,
    } =
      await import(
        "../src/report-timeless-relations.js"
      );

    const baseRow = {
      relation_id:
        "relation-valid",

      relation_type:
        "edr_founder_of",

      source_document_id:
        null,

      valid_from:
        null,

      valid_to:
        null,

      confidence:
        70,

      verification_status:
        "manual_review",

      relation_metadata: {
        source:
          "edr",

        review_required:
          true,
      },

      from_entity_id:
        "subject-entity-1",

      from_entity_type:
        "person",

      from_name:
        "Суб’єкт",

      from_metadata: {},

      to_entity_id:
        "organization-1",

      to_entity_type:
        "organization",

      to_name:
        "Організація",

      to_metadata: {},
    };

    const items =
      await loadTimelessEdrRelations(
        "subject-entity-1",
        {
          sql: async () => [
            {
              ...baseRow,

              relation_id:
                "   ",
            },

            {
              ...baseRow,

              relation_id:
                "relation-blank-target",

              to_entity_id:
                "   ",
            },
          ],
        },
      );

    assert.deepEqual(
      items,
      [],
    );
  },
);
