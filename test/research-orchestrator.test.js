import test from "node:test";
import assert from "node:assert/strict";

import {
  refineResearch,
  resolveResearchCandidate,
  startResearch,
} from "../src/research-orchestrator.js";

function memoryStore() {
  const records = new Map();

  return {
    records,
    async create(input) {
      const record = {
        id: "research-1",
        input,
        status: "created",
        identityStatus: "pending",
        candidates: [],
        clarificationOptions: {},
      };
      records.set(record.id, record);
      return record;
    },
    async get(id) {
      return records.get(id) ?? null;
    },
    async update(id, patch) {
      const next = { ...records.get(id), ...patch, id };
      records.set(id, next);
      return next;
    },
  };
}

const candidates = [
  {
    id: "candidate-1",
    canonical_name: "Іваненко Іван Іванович",
    identifiers: [{ type: "full_name", value: "Іваненко Іван Іванович" }],
    facts: [
      { type: "organization", value: "КМДА" },
      { type: "position", value: "Директор" },
      { type: "city", value: "Київ" },
      { type: "birth_date", value: "1980-01-02" },
    ],
  },
];

test("same research request is refined with system options", async () => {
  const store = memoryStore();
  const options = {
    store,
    loadCandidates: async () => candidates,
    createSubject: async () => ({ id: "subject-1" }),
  };
  const created = await startResearch(
    { fullName: "Іваненко Іван Іванович" },
    options,
  );

  assert.equal(created.id, "research-1");
  assert.equal(created.status, "identity_review");
  assert.deepEqual(created.clarificationOptions.organizations, ["КМДА"]);

  const refined = await refineResearch({
    researchRequestId: created.id,
    organization: "КМДА",
    birthDate: "1980-01-02",
  }, options);

  assert.equal(refined.id, created.id);
  assert.equal(refined.input.organization, "КМДА");
  assert.equal(refined.input.birthDate, "1980-01-02");
  assert.equal(refined.candidates[0].score, 100);
});

test("manual candidate accept and reject actions are preserved", async () => {
  const store = memoryStore();
  const options = {
    store,
    loadCandidates: async () => candidates,
    createSubject: async () => ({ id: "subject-1" }),
  };
  await startResearch({ fullName: "Іваненко Іван Іванович" }, options);

  const rejected = await resolveResearchCandidate({
    researchRequestId: "research-1",
    candidateId: "candidate-1",
    decision: "reject",
  }, options);
  assert.equal(rejected.candidates[0].decision, "rejected");

  const accepted = await resolveResearchCandidate({
    researchRequestId: "research-1",
    candidateId: "candidate-1",
    decision: "accept",
  }, options);
  assert.equal(accepted.candidates[0].decision, "accepted");
  assert.equal(accepted.status, "collecting");
  assert.equal(accepted.resolvedSubjectId, "subject-1");
});
