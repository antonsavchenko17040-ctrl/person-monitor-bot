import test from "node:test";
import assert from "node:assert/strict";

import {
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
