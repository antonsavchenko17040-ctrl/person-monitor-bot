import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeterministicFamilyContext as directFamily,
} from "../src/family-context.js";

import {
  loadDeterministicFamilyContext as legacyFamily,
} from "../src/chat-context.js";

test(
  "family context keeps legacy chat-context export",
  () => {
    assert.strictEqual(
      legacyFamily,
      directFamily,
    );
  },
);
