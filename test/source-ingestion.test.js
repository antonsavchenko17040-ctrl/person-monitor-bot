import test from "node:test";
import assert from "node:assert/strict";

import {
  parseNazkDeclarationDocumentGuid,
  parseNazkDeclarationName,
  parseNazkDeclarationYear,
} from "../src/source-ingestion.js";

test("extracts NACP declaration document GUID", () => {
  assert.equal(
    parseNazkDeclarationDocumentGuid(
      "https://public-api.nazk.gov.ua/v2/documents/a83f349e-8ebd-4884-8e32-a0ffd7351828",
    ),
    "a83f349e-8ebd-4884-8e32-a0ffd7351828",
  );
});

test("extracts declaration year", () => {
  assert.equal(
    parseNazkDeclarationYear(
      "Декларація НАЗК: САВЧЕНКО АНТОН ВІТАЛІЙОВИЧ — 2024",
    ),
    2024,
  );
});

test("extracts declarant name", () => {
  assert.equal(
    parseNazkDeclarationName(
      "Декларація НАЗК: САВЧЕНКО АНТОН ВІТАЛІЙОВИЧ — 2024",
    ),
    "САВЧЕНКО АНТОН ВІТАЛІЙОВИЧ",
  );
});

test("rejects invalid document URL", () => {
  assert.equal(
    parseNazkDeclarationDocumentGuid(
      "https://example.com/test",
    ),
    null,
  );
});
