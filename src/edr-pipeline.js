import {
  parseEdrZipFile,
  parseEdrZipStream,
} from "./edr-zip-parser.js";

import {
  normalizeEdrSubject,
} from "./edr-normalizer.js";

function requiredRecordType(
  value,
) {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    normalized === "uo" ||
    normalized === "organization"
  ) {
    return "organization";
  }

  if (
    normalized === "fop"
  ) {
    return "fop";
  }

  throw new TypeError(
    "Unsupported EDR record type",
  );
}

export async function*
normalizeEdrZipStream(
  input,
  {
    recordType,
    ...zipOptions
  } = {},
) {
  const normalizedRecordType =
    requiredRecordType(
      recordType,
    );

  for await (
    const subject of
      parseEdrZipStream(
        input,
        zipOptions,
      )
  ) {
    yield normalizeEdrSubject(
      subject,
      {
        recordType:
          normalizedRecordType,
      },
    );
  }
}

export async function*
normalizeEdrZipFile(
  zipPath,
  {
    recordType,
    ...zipOptions
  } = {},
) {
  const normalizedRecordType =
    requiredRecordType(
      recordType,
    );

  for await (
    const subject of
      parseEdrZipFile(
        zipPath,
        zipOptions,
      )
  ) {
    yield normalizeEdrSubject(
      subject,
      {
        recordType:
          normalizedRecordType,
      },
    );
  }
}
