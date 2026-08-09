import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeterministicRelationsContext,
} from "../src/relations-context.js";

test(
  "relations context rejects invalid input without database access",
  async () => {
    assert.equal(
      await loadDeterministicRelationsContext(
        "",
        2025,
      ),
      null,
    );

    assert.equal(
      await loadDeterministicRelationsContext(
        "entity",
        "invalid",
      ),
      null,
    );
  },
);
