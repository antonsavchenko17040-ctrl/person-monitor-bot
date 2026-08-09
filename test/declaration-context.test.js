import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeclarationYears,
  loadDeterministicDeclarationContext as directLoader,
} from "../src/declaration-context.js";

import {
  loadDeterministicDeclarationContext as legacyLoader,
} from "../src/chat-context.js";

test(
  "declaration context keeps legacy chat-context export",
  () => {
    assert.equal(
      typeof directLoader,
      "function",
    );

    assert.strictEqual(
      legacyLoader,
      directLoader,
    );
  },
);

test(
  "declaration years loader returns normalized available years",
  async () => {
    let requestedEntityId =
      null;

    const sql =
      async (
        _strings,
        entityId,
      ) => {
        requestedEntityId =
          entityId;

        return [
          { year: 2025 },
          { year: "2024" },
          { year: null },
        ];
      };

    const years =
      await loadDeclarationYears(
        "entity-1",
        { sql },
      );

    assert.equal(
      requestedEntityId,
      "entity-1",
    );

    assert.deepEqual(
      years,
      [2025, 2024],
    );
  },
);
