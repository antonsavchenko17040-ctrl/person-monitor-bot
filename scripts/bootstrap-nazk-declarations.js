import {
  bootstrapNazkDeclarations,
  previewNazkDeclarationBootstrap,
} from "../src/source-ingestion.js";

const dryRun =
  process.argv.includes("--dry-run");

if (dryRun) {
  const preview =
    await previewNazkDeclarationBootstrap();

  console.log(
    "\n=== NAZK DECLARATION PREVIEW ===",
  );

  console.table(
    preview.map((item) => ({
      name: item.declarationName,
      year: item.declarationYear,
      guid: item.documentGuid,
      score: item.score,
      status: item.status,
      valid: item.valid,
    })),
  );
}

const stats =
  await bootstrapNazkDeclarations({
    dryRun,
  });

console.log(
  dryRun
    ? "\n=== DRY RUN ==="
    : "\n=== INGESTION RESULT ===",
);

console.table([stats]);
