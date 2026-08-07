import { db } from "../src/db.js";
import { resolvePersonIdentity } from "../src/entity-resolution.js";

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
  ORDER BY full_name
`;

let failed = 0;

console.log("\n=== ENTITY RESOLUTION LIVE CHECK ===\n");

for (const subject of subjects) {
  const resolution = await resolvePersonIdentity({
    fullName: subject.full_name,
    organization: subject.organization,
    position: subject.position,
    city: subject.city,
  });

  const best = resolution.best;

  const correct =
    best &&
    String(best.entityId) === String(subject.entity_id);

  if (!correct) {
    failed += 1;
  }

  console.log(subject.full_name);
  console.log({
    expectedEntityId: subject.entity_id,
    resolvedEntityId: best?.entityId ?? null,
    score: best?.score ?? null,
    level: best?.level ?? null,
    correct,
    reasons: best?.reasons ?? [],
  });

  console.log("");
}

if (failed > 0) {
  console.error(
    `Entity resolution failed for ${failed} subject(s).`,
  );

  process.exit(1);
}

console.log(
  `✓ ${subjects.length}/${subjects.length} subjects resolved correctly`,
);
