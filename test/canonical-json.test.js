import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_JSON_HASH_VERSION,
  canonicalJson,
  canonicalJsonHash,
} from "../src/canonical-json.js";


test(
  "canonical JSON ignores object key order",
  () => {
    const left = {
      subject: {
        id: "subject-1",
        name: "Тест",
      },
      years: [
        2025,
        2024,
      ],
    };

    const right = {
      years: [
        2025,
        2024,
      ],
      subject: {
        name: "Тест",
        id: "subject-1",
      },
    };

    assert.equal(
      canonicalJson(left),
      canonicalJson(right),
    );

    assert.equal(
      canonicalJsonHash(left),
      canonicalJsonHash(right),
    );
  },
);


test(
  "canonical JSON preserves array order and exact text",
  () => {
    assert.notEqual(
      canonicalJsonHash({
        items: ["A", "B"],
      }),
      canonicalJsonHash({
        items: ["B", "A"],
      }),
    );

    assert.notEqual(
      canonicalJsonHash({
        value: "ABC",
      }),
      canonicalJsonHash({
        value: "abc",
      }),
    );

    assert.notEqual(
      canonicalJsonHash({
        value: "A-B",
      }),
      canonicalJsonHash({
        value: "AB",
      }),
    );
  },
);


test(
  "canonical JSON rejects unsupported values",
  () => {
    assert.throws(
      () =>
        canonicalJson({
          value: undefined,
        }),
      TypeError,
    );

    assert.throws(
      () =>
        canonicalJson({
          value: Number.NaN,
        }),
      TypeError,
    );

    assert.throws(
      () =>
        canonicalJson({
          value: 1n,
        }),
      TypeError,
    );
  },
);


test(
  "canonical JSON hash contract is versioned SHA-256",
  () => {
    const hash =
      canonicalJsonHash({
        schema_version:
          "report-model-v1",
      });

    assert.equal(
      CANONICAL_JSON_HASH_VERSION,
      "canonical-json-sha256-v1",
    );

    assert.match(
      hash,
      /^[0-9a-f]{64}$/,
    );
  },
);
