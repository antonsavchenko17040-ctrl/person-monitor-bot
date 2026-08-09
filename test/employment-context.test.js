import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeterministicEmploymentContext as directEmployment,
} from "../src/employment-context.js";

import {
  loadDeterministicEmploymentContext as legacyEmployment,
} from "../src/chat-context.js";

test(
  "employment context keeps legacy chat-context export",
  () => {
    assert.strictEqual(
      legacyEmployment,
      directEmployment,
    );
  },
);
