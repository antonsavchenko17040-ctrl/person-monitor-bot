import { db } from "../src/db.js";
import { loadSubjectGraph } from "../src/subject-graph.js";

const FORBIDDEN_KEYS = new Set([
  "raw_payload",
  "fact_ids",
  "source_document_id",
  "tax_number",
  "tax_id",
  "passport",
  "passport_number",
  "birthday",
  "birth_date",
  "date_of_birth",
  "confidential_address",
]);

function walk(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walk(item, `${path}[${index}]`)
    );
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(
        `Forbidden key leaked: ${path}.${key}`
      );
    }

    walk(child, `${path}.${key}`);
  }
}

function assertGraph(graph, subjectId) {
  if (!graph || typeof graph !== "object") {
    throw new Error(
      `Graph payload missing for subject ${subjectId}`
    );
  }

  if (!Array.isArray(graph.available_years)) {
    throw new Error(
      `availableYears must be an array for ${subjectId}`
    );
  }

  if (!Array.isArray(graph.nodes)) {
    throw new Error(
      `nodes must be an array for ${subjectId}`
    );
  }

  if (!Array.isArray(graph.edges)) {
    throw new Error(
      `edges must be an array for ${subjectId}`
    );
  }

  walk(graph);
}

const sql = db();

const subjects = await sql`
  SELECT
    id,
    full_name
  FROM subjects
  ORDER BY full_name
`;

if (!subjects.length) {
  throw new Error("No subjects found");
}

console.log("\n=== SUBJECT GRAPH VERIFY ===");

for (const subject of subjects) {
  const latest =
    await loadSubjectGraph(
      subject.id,
    );

  assertGraph(
    latest,
    subject.id,
  );

  console.log(
    `${subject.full_name}: ` +
    `year=${latest.year ?? "none"}, ` +
    `nodes=${latest.nodes.length}, ` +
    `edges=${latest.edges.length}`,
  );

  for (
    const year of
    latest.available_years
  ) {
    const graph =
      await loadSubjectGraph(
        subject.id,
        { year },
      );

    assertGraph(
      graph,
      subject.id,
    );

    if (
      graph.year !== year
    ) {
      throw new Error(
        `Year mismatch for ${subject.full_name}: ` +
        `requested ${year}, got ${graph.year}`,
      );
    }
  }
}

console.log("\nSUBJECT GRAPH VERIFY PASSED");
