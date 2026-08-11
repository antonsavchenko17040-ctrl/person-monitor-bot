import {
  db,
} from "../src/db.js";

import {
  discoverEdrDataset,
} from "../src/edr-dataset-discovery.js";

import {
  getActiveEdrSnapshot,
} from "../src/edr-snapshot-store.js";

import {
  buildEdrWeeklyCheck,
} from "../src/edr-weekly-check.js";

const sql =
  db();

console.log(
  "=== EDR WEEKLY CHECK ===",
);

const discovered =
  await discoverEdrDataset();

const activeSnapshot =
  await getActiveEdrSnapshot(
    sql,
  );

const result =
  buildEdrWeeklyCheck({
    discovered,
    activeSnapshot,
  });

console.log(
  JSON.stringify(
    result,
    null,
    2,
  ),
);

if (
  result.update_available
) {
  console.log(
    "EDR dataset update detected.",
  );
} else {
  console.log(
    "Active EDR snapshot is current.",
  );
}

console.log(
  "Full EDR import remains disabled by storage guard.",
);
