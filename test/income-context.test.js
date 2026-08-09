import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeterministicIncomeAnalyticsContext as directSingle,
  loadDeterministicMultiYearIncomeAnalyticsContext as directMulti,
  loadDeterministicIncomeContext as directDetail,
} from "../src/income-context.js";

import {
  loadDeterministicIncomeAnalyticsContext as legacySingle,
  loadDeterministicMultiYearIncomeAnalyticsContext as legacyMulti,
  loadDeterministicIncomeContext as legacyDetail,
} from "../src/chat-context.js";

test(
  "income context keeps legacy chat-context exports",
  () => {
    assert.strictEqual(
      legacySingle,
      directSingle,
    );

    assert.strictEqual(
      legacyMulti,
      directMulti,
    );

    assert.strictEqual(
      legacyDetail,
      directDetail,
    );
  },
);
