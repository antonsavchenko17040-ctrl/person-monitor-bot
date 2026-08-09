import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeterministicVehicleContext as directVehicle,
} from "../src/vehicle-context.js";

import {
  loadDeterministicVehicleContext as legacyVehicle,
} from "../src/chat-context.js";

test(
  "vehicle context keeps legacy chat-context export",
  () => {
    assert.strictEqual(
      legacyVehicle,
      directVehicle,
    );
  },
);
