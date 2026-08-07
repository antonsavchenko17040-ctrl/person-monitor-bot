import { db } from "../src/db.js";

import {
  getNazkStepShapes,
} from "../src/nazk-api.js";

const sql = db();

const rows = await sql`
  SELECT
    raw_payload -> 'nazk_document'
      AS payload

  FROM source_documents

  WHERE
    raw_payload
      ? 'nazk_document'

    AND metadata ->>
      'document_kind'
      = 'nazk_declaration'

  ORDER BY fetched_at DESC
`;

if (!rows.length) {
  console.error(
    "No synchronized NACP documents.",
  );

  process.exit(1);
}

const aggregate = new Map();

for (const row of rows) {
  const shapes =
    getNazkStepShapes(
      row.payload,
    );

  for (const shape of shapes) {
    if (!aggregate.has(shape.step)) {
      aggregate.set(
        shape.step,
        {
          step: shape.step,
          documents: 0,
          types: new Set(),
          maxItems: 0,
          keys: new Set(),
        },
      );
    }

    const item =
      aggregate.get(shape.step);

    item.documents += 1;
    item.types.add(shape.type);

    item.maxItems = Math.max(
      item.maxItems,
      shape.count,
    );

    for (const key of shape.keys) {
      item.keys.add(key);
    }
  }
}

const output =
  [...aggregate.values()]
    .sort(
      (a, b) =>
        Number(a.step.slice(5)) -
        Number(b.step.slice(5)),
    )
    .map((item) => ({
      step: item.step,
      documents: item.documents,
      types:
        [...item.types].join(", "),

      max_items:
        item.maxItems,

      keys:
        [...item.keys]
          .sort()
          .join(", "),
    }));

console.log(
  `\nDocuments inspected: ${rows.length}`,
);

console.table(output);
