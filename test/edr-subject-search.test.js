import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_SUBJECT_PERSON_RELATION_TYPES,
  findActiveEdrSubjectCandidates,
} from "../src/edr-subject-search.js";

const sql = () => {};

function organization(overrides = {}) {
  return {
    id: "record-org-1",
    snapshot_id: "snapshot-1",
    record_type: "organization",
    name: "ТОВ ТЕСТ",
    normalized_name: "тов тест",
    edrpou: "12345678",
    ...overrides,
  };
}

function fop(overrides = {}) {
  return {
    id: "record-fop-1",
    snapshot_id: "snapshot-1",
    record_type: "fop",
    name: "ІВАНЕНКО ІВАН ІВАНОВИЧ",
    normalized_name: "іваненко іван іванович",
    edrpou: null,
    ...overrides,
  };
}

function relation(overrides = {}) {
  return {
    id: "relation-1",
    snapshot_id: "snapshot-1",
    record_id: "record-org-1",
    record_type: "organization",
    relation_type: "founder",
    value_text: "ІВАНЕНКО ІВАН ІВАНОВИЧ",
    normalized_value: "іваненко іван іванович",
    ...overrides,
  };
}

function makeFinders({
  records = [],
  relations = [],
} = {}) {
  const recordCalls = [];
  const relationCalls = [];

  const findRecords = async (_sql, input) => {
    recordCalls.push(input);
    return records;
  };

  const findRelations = async (_sql, input) => {
    relationCalls.push(input);
    return relations;
  };

  return {
    findRecords,
    findRelations,
    recordCalls,
    relationCalls,
  };
}

test("requires sql function", async () => {
  await assert.rejects(
    findActiveEdrSubjectCandidates(
      null,
      { name: "ТОВ ТЕСТ" },
    ),
    /sql must be a tagged-template function/,
  );
});

test("requires name or EDRPOU", async () => {
  await assert.rejects(
    findActiveEdrSubjectCandidates(
      sql,
      {},
    ),
    /fullName\/name or edrpou is required/,
  );
});

test("EDRPOU only uses organization lookup", async () => {
  const finders = makeFinders({
    records: [organization()],
  });

  const result =
    await findActiveEdrSubjectCandidates(
      sql,
      { edrpou: " 12345678 " },
      finders,
    );

  assert.equal(result.status, "matched");
  assert.equal(
    result.decision,
    "exact_stable_identifier",
  );
  assert.equal(result.best.hardMatch, true);

  assert.equal(
    finders.recordCalls.length,
    1,
  );

  assert.deepEqual(
    finders.recordCalls[0],
    {
      edrpou: "12345678",
      recordType: "organization",
      limit: 50,
    },
  );

  assert.equal(
    finders.relationCalls.length,
    0,
  );
});

test("name lookup searches records and person relations", async () => {
  const finders = makeFinders({
    records: [fop()],
    relations: [relation()],
  });

  const result =
    await findActiveEdrSubjectCandidates(
      sql,
      {
        fullName:
          "  ІВАНЕНКО   ІВАН ІВАНОВИЧ  ",
      },
      finders,
    );

  assert.equal(
    finders.recordCalls.length,
    1,
  );

  assert.deepEqual(
    finders.recordCalls[0],
    {
      name:
        "іваненко іван іванович",
      limit: 50,
    },
  );

  assert.equal(
    finders.relationCalls.length,
    1,
  );

  assert.equal(
    finders.relationCalls[0].value,
    "іваненко іван іванович",
  );

  assert.deepEqual(
    finders.relationCalls[0].relationTypes,
    [
      "founder",
      "beneficiary",
      "signer",
      "member",
      "executive_power",
      "superior_management",
    ],
  );

  assert.equal(
    finders.relationCalls[0].limit,
    100,
  );

  assert.equal(
    result.retrieval.record_count,
    1,
  );

  assert.equal(
    result.retrieval.relation_count,
    1,
  );

  assert.deepEqual(
    EDR_SUBJECT_PERSON_RELATION_TYPES,
    [
      "founder",
      "beneficiary",
      "signer",
      "member",
      "executive_power",
      "superior_management",
    ],
  );
});

test("duplicate records from name and EDRPOU are removed", async () => {
  const candidate = organization();

  const recordCalls = [];

  const result =
    await findActiveEdrSubjectCandidates(
      sql,
      {
        name: "ТОВ ТЕСТ",
        edrpou: "12345678",
      },
      {
        findRecords:
          async (_sql, input) => {
            recordCalls.push(input);
            return [candidate];
          },
        findRelations:
          async () => [],
      },
    );

  assert.equal(recordCalls.length, 2);
  assert.equal(result.records.length, 1);
  assert.equal(
    result.retrieval.record_count,
    1,
  );
});

test("duplicate relations are removed", async () => {
  const candidate = relation();

  const result =
    await findActiveEdrSubjectCandidates(
      sql,
      {
        fullName:
          "ІВАНЕНКО ІВАН ІВАНОВИЧ",
      },
      {
        findRecords:
          async () => [],
        findRelations:
          async () => [
            candidate,
            { ...candidate },
          ],
      },
    );

  assert.equal(
    result.relations.length,
    1,
  );

  assert.equal(
    result.retrieval.relation_count,
    1,
  );
});

test("custom lookup limits are forwarded", async () => {
  const finders = makeFinders();

  await findActiveEdrSubjectCandidates(
    sql,
    {
      fullName:
        "ІВАНЕНКО ІВАН ІВАНОВИЧ",
    },
    {
      ...finders,
      recordLimit: 7,
      relationLimit: 9,
    },
  );

  assert.equal(
    finders.recordCalls[0].limit,
    7,
  );

  assert.equal(
    finders.relationCalls[0].limit,
    9,
  );
});

test("empty active snapshot result is unmatched", async () => {
  const finders = makeFinders();

  const result =
    await findActiveEdrSubjectCandidates(
      sql,
      {
        fullName:
          "НЕВІДОМА ОСОБА",
      },
      finders,
    );

  assert.equal(
    result.status,
    "unmatched",
  );

  assert.equal(
    result.decision,
    "no_match",
  );

  assert.equal(
    result.best,
    null,
  );
});

test("exact FOP name remains ambiguous", async () => {
  const result =
    await findActiveEdrSubjectCandidates(
      sql,
      {
        fullName:
          "ІВАНЕНКО ІВАН ІВАНОВИЧ",
      },
      {
        findRecords:
          async () => [fop()],
        findRelations:
          async () => [],
      },
    );

  assert.equal(
    result.status,
    "ambiguous",
  );

  assert.equal(
    result.decision,
    "manual_review",
  );

  assert.equal(
    result.best.score,
    70,
  );

  assert.equal(
    result.best.hardMatch,
    false,
  );
});

test("hard EDRPOU match wins over name-only relation", async () => {
  const recordCandidate =
    organization();

  const relationCandidate =
    relation();

  const result =
    await findActiveEdrSubjectCandidates(
      sql,
      {
        fullName:
          "ІВАНЕНКО ІВАН ІВАНОВИЧ",
        edrpou: "12345678",
      },
      {
        findRecords:
          async (_sql, input) => {
            if (input.edrpou) {
              return [recordCandidate];
            }

            return [];
          },
        findRelations:
          async () => [
            relationCandidate,
          ],
      },
    );

  assert.equal(
    result.status,
    "matched",
  );

  assert.equal(
    result.best.candidateKind,
    "record",
  );

  assert.equal(
    result.best.score,
    100,
  );

  assert.equal(
    result.best.hardMatch,
    true,
  );
});

test("retrieval metadata exposes normalized lookup", async () => {
  const finders = makeFinders();

  const result =
    await findActiveEdrSubjectCandidates(
      sql,
      {
        fullName:
          "  ІВАНЕНКО   ІВАН ІВАНОВИЧ ",
        edrpou:
          " 12345678 ",
      },
      finders,
    );

  assert.equal(
    result.retrieval.normalized_name,
    "іваненко іван іванович",
  );

  assert.equal(
    result.retrieval.edrpou,
    "12345678",
  );

  assert.equal(
    result.retrieval.record_limit,
    50,
  );

  assert.equal(
    result.retrieval.relation_limit,
    100,
  );
});
