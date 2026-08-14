import test from "node:test";
import assert from "node:assert/strict";

import { createResearchApiHandler } from "../src/research-api.js";

function responseMock() {
  const state = { status: null, body: null, headers: {} };
  return {
    state,
    setHeader(name, value) { state.headers[name] = value; },
    status(code) { state.status = code; return this; },
    json(body) { state.body = body; return this; },
  };
}

test("POST research returns request id", async () => {
  const handler = createResearchApiHandler({
    start: async (body) => ({
      id: "research-1",
      input: body,
      status: "identity_review",
      candidates: [],
    }),
  });
  const response = responseMock();

  await handler({ method: "POST", query: { route: "research" }, body: { fullName: "Іваненко Іван" } }, response);

  assert.equal(response.state.status, 201);
  assert.equal(response.state.body.researchRequestId, "research-1");
});

test("research refinement uses dedicated external route", async () => {
  const handler = createResearchApiHandler({
    refine: async (body) => ({ id: body.researchRequestId, status: "identity_review" }),
  });
  const response = responseMock();

  await handler({ method: "POST", query: { route: "research-refine" }, body: { researchRequestId: "research-1", city: "Київ" } }, response);

  assert.equal(response.state.status, 200);
  assert.equal(response.state.body.research.id, "research-1");
});

test("research API rejects unsupported method", async () => {
  const handler = createResearchApiHandler();
  const response = responseMock();

  await handler({ method: "GET", query: { route: "research" } }, response);
  assert.equal(response.state.status, 405);
});
