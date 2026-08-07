import { db } from "../src/db.js";

import {
  previewPersonObservation,
} from "../src/identity-observations.js";

const sql = db();

const subjects = await sql`
  SELECT
    id,
    entity_id,
    full_name,
    organization,
    position,
    city
  FROM subjects
  WHERE entity_id IS NOT NULL
  ORDER BY full_name
`;

let failures = 0;

console.log(
  "\n=== IDENTITY OBSERVATION PREVIEW ===\n",
);

for (const subject of subjects) {
  /*
   * Test 1:
   * stable subject_id MUST resolve exactly.
   */
  const exact =
    await previewPersonObservation({
      fullName: "Навмисно інше ПІБ",

      identifiers: [
        {
          type: "subject_id",
          value: String(subject.id),
          source: "subjects",
        },
      ],
    });

  const exactCorrect =
    exact.status === "matched" &&
    exact.score === 100 &&
    String(exact.entityId) ===
      String(subject.entity_id);

  /*
   * Test 2:
   * full context should resolve existing person.
   */
  const contextual =
    await previewPersonObservation({
      fullName: subject.full_name,
      position: subject.position,
      organization: subject.organization,
      city: subject.city,
    });

  const contextCorrect =
    contextual.status === "matched" &&
    String(contextual.entityId) ===
      String(subject.entity_id);

  /*
   * Test 3:
   * PІБ alone should NOT silently auto-merge.
   */
  const nameOnly =
    await previewPersonObservation({
      fullName: subject.full_name,
    });

  const nameOnlySafe =
    nameOnly.status === "ambiguous" &&
    nameOnly.decision === "manual_review";

  if (
    !exactCorrect ||
    !contextCorrect ||
    !nameOnlySafe
  ) {
    failures += 1;
  }

  console.log(subject.full_name);

  console.log({
    exact: {
      score: exact.score,
      status: exact.status,
      decision: exact.decision,
      correct: exactCorrect,
    },

    contextual: {
      score: contextual.score,
      status: contextual.status,
      decision: contextual.decision,
      correct: contextCorrect,
    },

    nameOnly: {
      score: nameOnly.score,
      status: nameOnly.status,
      decision: nameOnly.decision,
      safe: nameOnlySafe,
    },
  });

  console.log("");
}

if (failures > 0) {
  console.error(
    `Failed for ${failures} subject(s).`,
  );

  process.exit(1);
}

console.log(
  `✓ ${subjects.length}/${subjects.length} subjects passed ER_V2 checks`,
);
