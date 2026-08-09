import test from "node:test";
import assert from "node:assert/strict";

import {
  loadSubjectKnowledge,
} from "../src/chat-context.js";

test(
  "chat knowledge loader exports function",
  () => {
    assert.equal(
      typeof loadSubjectKnowledge,
      "function",
    );
  },
);
