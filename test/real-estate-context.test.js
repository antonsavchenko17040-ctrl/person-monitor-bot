import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeterministicRealEstateContext as directRealEstate,
} from "../src/real-estate-context.js";

import {
  loadDeterministicRealEstateContext as legacyRealEstate,
} from "../src/chat-context.js";

test(
  "real estate context keeps legacy chat-context export",
  () => {
    assert.strictEqual(
      legacyRealEstate,
      directRealEstate,
    );
  },
);
