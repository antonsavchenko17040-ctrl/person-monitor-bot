import test from "node:test";
import assert from "node:assert/strict";

import {
  getNazkDocumentGuid,
  getNazkStepShapes,
  isNazkDocumentUrl,
} from "../src/nazk-api.js";

const guid =
  "a83f349e-8ebd-4884-8e32-a0ffd7351828";

test("accepts official NACP document URL", () => {
  assert.equal(
    isNazkDocumentUrl(
      `https://public-api.nazk.gov.ua/v2/documents/${guid}`,
    ),
    true,
  );
});

test("rejects non-NACP document URL", () => {
  assert.equal(
    isNazkDocumentUrl(
      `https://example.com/v2/documents/${guid}`,
    ),
    false,
  );
});

test("extracts document GUID", () => {
  assert.equal(
    getNazkDocumentGuid(
      `https://public-api.nazk.gov.ua/v2/documents/${guid}`,
    ),
    guid,
  );
});

test("inspects NACP step data shape", () => {
  const result =
    getNazkStepShapes({
      data: {
        step_1: {
          data: [
            {
              firstname: "A",
              lastname: "B",
            },
          ],
        },

        step_2: {
          data: {
            workplace: "X",
          },
        },
      },
    });

  assert.equal(
    result.length,
    2,
  );

  assert.equal(
    result[0].type,
    "array",
  );

  assert.deepEqual(
    result[0].keys,
    [
      "firstname",
      "lastname",
    ],
  );

  assert.equal(
    result[1].type,
    "object",
  );
});
