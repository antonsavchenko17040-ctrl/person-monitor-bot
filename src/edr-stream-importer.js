import {
  EDR_MAX_BATCH_RECORDS,
  writeEdrImportBatch,
} from "./edr-batch-writer.js";

import {
  buildEdrImportRow,
  buildEdrRelationRows,
} from "./edr-import-shape.js";

import {
  normalizeEdrZipFile,
} from "./edr-pipeline.js";

export const EDR_DEFAULT_BATCH_RECORDS = 500;

function requiredText(
  value,
  field,
) {
  const text =
    String(value ?? "").trim();

  if (!text) {
    throw new TypeError(
      `${field} is required`,
    );
  }

  return text;
}

function batchSizeValue(
  value,
) {
  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number >
      EDR_MAX_BATCH_RECORDS
  ) {
    throw new RangeError(
      `batchSize must be an integer between 1 and ${EDR_MAX_BATCH_RECORDS}`,
    );
  }

  return number;
}

function sequenceValue(
  value,
) {
  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    throw new RangeError(
      "startSequence must be a non-negative safe integer",
    );
  }

  return number;
}

function requireRecordStream(
  value,
) {
  if (
    !value ||
    (
      typeof value[Symbol.iterator] !==
        "function" &&
      typeof value[Symbol.asyncIterator] !==
        "function"
    )
  ) {
    throw new TypeError(
      "records must be an iterable or async iterable",
    );
  }

  return value;
}

function requireWriter(
  value,
) {
  if (
    typeof value !==
    "function"
  ) {
    throw new TypeError(
      "writeBatch must be a function",
    );
  }

  return value;
}

function optionalCallback(
  value,
  field,
) {
  if (
    value == null
  ) {
    return null;
  }

  if (
    typeof value !==
    "function"
  ) {
    throw new TypeError(
      `${field} must be a function`,
    );
  }

  return value;
}

function writtenCount(
  value,
  field,
) {
  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    throw new Error(
      `${field} returned an invalid count`,
    );
  }

  return number;
}

export async function
importEdrRecordStream(
  sql,
  records,
  {
    snapshotId,
    batchSize =
      EDR_DEFAULT_BATCH_RECORDS,
    startSequence = 0,
    writeBatch =
      writeEdrImportBatch,
    onBatch = null,
  } = {},
) {
  const normalizedSnapshotId =
    requiredText(
      snapshotId,
      "snapshotId",
    );

  const normalizedBatchSize =
    batchSizeValue(
      batchSize,
    );

  let nextSequence =
    sequenceValue(
      startSequence,
    );

  const recordStream =
    requireRecordStream(
      records,
    );

  const batchWriter =
    requireWriter(
      writeBatch,
    );

  const batchCallback =
    optionalCallback(
      onBatch,
      "onBatch",
    );

  let batchRecords = [];
  let batchRelations = [];

  let batches = 0;
  let recordsSeen = 0;
  let relationsSeen = 0;
  let recordsWritten = 0;
  let relationsWritten = 0;

  async function flush() {
    if (
      batchRecords.length === 0
    ) {
      return;
    }

    const expectedRecords =
      batchRecords.length;

    const expectedRelations =
      batchRelations.length;

    const result =
      await batchWriter(
        sql,
        {
          snapshotId:
            normalizedSnapshotId,

          records:
            batchRecords,

          relations:
            batchRelations,
        },
      );

    const batchRecordsWritten =
      writtenCount(
        result?.records_written,
        "records_written",
      );

    const batchRelationsWritten =
      writtenCount(
        result?.relations_written,
        "relations_written",
      );

    if (
      batchRecordsWritten !==
        expectedRecords
    ) {
      throw new Error(
        "EDR batch writer record count mismatch",
      );
    }

    if (
      batchRelationsWritten !==
        expectedRelations
    ) {
      throw new Error(
        "EDR batch writer relation count mismatch",
      );
    }

    batches += 1;

    recordsWritten +=
      batchRecordsWritten;

    relationsWritten +=
      batchRelationsWritten;

    if (
      batchCallback
    ) {
      await batchCallback({
        batch: batches,
        records:
          batchRecordsWritten,
        relations:
          batchRelationsWritten,
        records_seen:
          recordsSeen,
        relations_seen:
          relationsSeen,
        next_sequence:
          nextSequence,
      });
    }

    batchRecords = [];
    batchRelations = [];
  }

  for await (
    const record of recordStream
  ) {
    const sourceSequence =
      nextSequence;

    const importRow =
      buildEdrImportRow(
        record,
        {
          sourceSequence,
        },
      );

    const relationRows =
      buildEdrRelationRows(
        record,
        {
          sourceSequence,
        },
      );

    batchRecords.push(
      importRow,
    );

    batchRelations.push(
      ...relationRows,
    );

    recordsSeen += 1;

    relationsSeen +=
      relationRows.length;

    nextSequence += 1;

    if (
      batchRecords.length >=
        normalizedBatchSize
    ) {
      await flush();
    }
  }

  await flush();

  return {
    batches,
    records_seen:
      recordsSeen,
    relations_seen:
      relationsSeen,
    records_written:
      recordsWritten,
    relations_written:
      relationsWritten,
    start_sequence:
      sequenceValue(
        startSequence,
      ),
    next_sequence:
      nextSequence,
  };
}

export async function
importEdrZipFileToSnapshot(
  sql,
  zipPath,
  {
    snapshotId,
    recordType,
    batchSize =
      EDR_DEFAULT_BATCH_RECORDS,
    startSequence = 0,
    writeBatch =
      writeEdrImportBatch,
    onBatch = null,
    requireXml = true,
    requireSubject = true,
    onXmlEntry = null,
  } = {},
) {
  const records =
    normalizeEdrZipFile(
      requiredText(
        zipPath,
        "zipPath",
      ),
      {
        recordType:
          requiredText(
            recordType,
            "recordType",
          ),
        requireXml,
        requireSubject,
        onXmlEntry:
          optionalCallback(
            onXmlEntry,
            "onXmlEntry",
          ),
      },
    );

  return importEdrRecordStream(
    sql,
    records,
    {
      snapshotId,
      batchSize,
      startSequence,
      writeBatch,
      onBatch,
    },
  );
}
