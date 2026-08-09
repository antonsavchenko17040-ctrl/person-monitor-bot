import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeterministicCashContext as directCash,
} from "../src/cash-context.js";

import {
  loadDeterministicCashContext as legacyCash,
} from "../src/chat-context.js";

test(
  "cash context keeps legacy chat-context export",
  () => {
    assert.strictEqual(
      legacyCash,
      directCash,
    );
  },
);
