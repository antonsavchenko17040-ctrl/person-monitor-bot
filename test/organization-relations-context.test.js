import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeterministicOrganizationRelationsContext as directRelations,
} from "../src/organization-relations-context.js";

import {
  loadDeterministicOrganizationRelationsContext as legacyRelations,
} from "../src/chat-context.js";

test(
  "organization relations context keeps legacy chat-context export",
  () => {
    assert.strictEqual(
      legacyRelations,
      directRelations,
    );
  },
);
