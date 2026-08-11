import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSET_TRANSITION_VERSION,
  isDeclarantAssetFact,
  buildAssetTransitionEvents,
} from "../src/asset-transitions.js";

function vehicle({
  model = "Camry",
  role = "declarant",
} = {}) {
  return {
    fact_type:
      "vehicle",

    value_text:
      "Toyota " + model,

    value_json: {
      person: {
        role,
      },

      brand:
        "Toyota",

      model,

      production_year:
        2020,

      acquisition_date:
        "01.01.2020",

      cost:
        500000,

      rights: [],
    },
  };
}

function estate({
  city = "Київ",
  role = "declarant",
} = {}) {
  return {
    fact_type:
      "real_estate",

    value_text:
      "Квартира",

    value_number:
      80,

    value_json: {
      person: {
        role,
      },

      object_type:
        "Квартира",

      total_area:
        80,

      country:
        "Україна",

      region:
        null,

      district:
        null,

      city,

      acquisition_date:
        "01.01.2020",

      cost:
        2000000,

      rights: [],
    },
  };
}

test(
  "exports asset transition version",
  () => {
    assert.equal(
      ASSET_TRANSITION_VERSION,
      "asset-transition-v1",
    );
  },
);

test(
  "recognizes declarant asset",
  () => {
    assert.equal(
      isDeclarantAssetFact(
        vehicle(),
      ),
      true,
    );
  },
);

test(
  "recognizes asset through declarant ownership right",
  () => {
    const fact =
      vehicle({
        role:
          "third_party",
      });

    fact.value_json.rights = [
      {
        actor: {
          role:
            "declarant",
        },
      },
    ];

    assert.equal(
      isDeclarantAssetFact(
        fact,
      ),
      true,
    );
  },
);

test(
  "ignores unrelated third party asset",
  () => {
    assert.equal(
      isDeclarantAssetFact(
        vehicle({
          role:
            "third_party",
        }),
      ),
      false,
    );
  },
);

test(
  "new asset is observed as appeared, not purchased",
  () => {
    const result =
      buildAssetTransitionEvents({
        fromYear: 2024,
        toYear: 2025,

        oldFacts: [],

        newFacts: [
          vehicle(),
        ],
      });

    assert.equal(
      result.summary.appeared,
      1,
    );

    assert.equal(
      result.appeared[0]
        .event_type,
      "appeared",
    );

    assert.equal(
      result.appeared[0]
        .transaction_status,
      "not_inferred",
    );
  },
);

test(
  "missing asset is observed as disappeared, not sold",
  () => {
    const result =
      buildAssetTransitionEvents({
        fromYear: 2024,
        toYear: 2025,

        oldFacts: [
          estate(),
        ],

        newFacts: [],
      });

    assert.equal(
      result.summary.disappeared,
      1,
    );

    assert.equal(
      result.disappeared[0]
        .event_type,
      "disappeared",
    );

    assert.equal(
      result.disappeared[0]
        .transaction_status,
      "not_inferred",
    );
  },
);

test(
  "unchanged asset does not produce appearance or disappearance event",
  () => {
    const result =
      buildAssetTransitionEvents({
        fromYear: 2024,
        toYear: 2025,

        oldFacts: [
          vehicle(),
        ],

        newFacts: [
          vehicle(),
        ],
      });

    assert.equal(
      result.summary.unchanged,
      1,
    );

    assert.equal(
      result.summary.appeared,
      0,
    );

    assert.equal(
      result.summary.disappeared,
      0,
    );
  },
);

test(
  "counts vehicle and real estate changes separately",
  () => {
    const result =
      buildAssetTransitionEvents({
        fromYear: 2024,
        toYear: 2025,

        oldFacts: [
          vehicle({
            model:
              "Camry",
          }),
        ],

        newFacts: [
          vehicle({
            model:
              "Corolla",
          }),

          estate({
            city:
              "Київ",
          }),
        ],
      });

    assert.equal(
      result.summary
        .vehicles_disappeared,
      1,
    );

    assert.equal(
      result.summary
        .vehicles_appeared,
      1,
    );

    assert.equal(
      result.summary
        .real_estate_appeared,
      1,
    );
  },
);

test(
  "non-consecutive years are marked as a gap",
  () => {
    const result =
      buildAssetTransitionEvents({
        fromYear: 2022,
        toYear: 2025,
        oldFacts: [],
        newFacts: [],
      });

    assert.equal(
      result.year_gap,
      3,
    );

    assert.equal(
      result.continuity,
      "gap",
    );
  },
);

test(
  "rejects reversed or equal years",
  () => {
    assert.throws(
      () =>
        buildAssetTransitionEvents({
          fromYear: 2025,
          toYear: 2025,
        }),
      /toYear must be greater/,
    );

    assert.throws(
      () =>
        buildAssetTransitionEvents({
          fromYear: 2025,
          toYear: 2024,
        }),
      /toYear must be greater/,
    );
  },
);
