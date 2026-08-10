import {
  createReadStream,
} from "node:fs";

import {
  basename,
} from "node:path";

import {
  Readable,
} from "node:stream";

import unzipper from "unzipper";

import {
  parseEdrSubjectXmlStream,
} from "./edr-xml-parser.js";

function requiredText(
  value,
  field,
) {
  const normalized =
    String(value ?? "").trim();

  if (!normalized) {
    throw new TypeError(
      `${field} is required`,
    );
  }

  return normalized;
}

function toNodeReadable(
  input,
) {
  if (
    Buffer.isBuffer(input) ||
    ArrayBuffer.isView(input)
  ) {
    return Readable.from([
      input,
    ]);
  }

  if (
    input &&
    typeof input.pipe ===
      "function"
  ) {
    return input;
  }

  if (
    input &&
    typeof input[
      Symbol.asyncIterator
    ] === "function"
  ) {
    return Readable.from(
      input,
    );
  }

  throw new TypeError(
    "EDR ZIP input must be a Buffer, stream, or async iterable",
  );
}

function normalizeEntryPath(
  value,
) {
  return String(
    value ?? "",
  )
    .replaceAll(
      "\\",
      "/",
    )
    .trim();
}

export function
isEdrXmlZipEntry(
  entry = {},
) {
  if (
    entry.type &&
    entry.type !== "File"
  ) {
    return false;
  }

  const entryPath =
    normalizeEntryPath(
      entry.path,
    );

  if (!entryPath) {
    return false;
  }

  const fileName =
    basename(
      entryPath,
    );

  return (
    fileName.length > 4 &&
    fileName
      .toLowerCase()
      .endsWith(".xml")
  );
}

export async function*
parseEdrZipStream(
  input,
  {
    requireXml = true,
    requireSubject = true,
    onXmlEntry = null,
  } = {},
) {
  if (
    onXmlEntry != null &&
    typeof onXmlEntry !==
      "function"
  ) {
    throw new TypeError(
      "onXmlEntry must be a function",
    );
  }

  const source =
    toNodeReadable(
      input,
    );

  const archive =
    source.pipe(
      unzipper.Parse({
        forceStream: true,
      }),
    );

  let xmlEntryCount = 0;
  let subjectCount = 0;

  for await (
    const entry of archive
  ) {
    if (
      !isEdrXmlZipEntry(
        entry,
      )
    ) {
      entry.autodrain();
      continue;
    }

    xmlEntryCount += 1;

    const entryPath =
      normalizeEntryPath(
        entry.path,
      );

    if (onXmlEntry) {
      await onXmlEntry({
        path:
          entryPath,

        name:
          basename(
            entryPath,
          ),

        index:
          xmlEntryCount,
      });
    }

    for await (
      const subject of
        parseEdrSubjectXmlStream(
          entry,
          {
            requireSubject:
              false,
          },
        )
    ) {
      subjectCount += 1;

      yield subject;
    }
  }

  if (
    requireXml &&
    xmlEntryCount === 0
  ) {
    throw new Error(
      "EDR ZIP contains no XML file",
    );
  }

  if (
    requireSubject &&
    subjectCount === 0
  ) {
    throw new Error(
      "EDR ZIP contains no SUBJECT element",
    );
  }
}

export async function*
parseEdrZipFile(
  zipPath,
  options = {},
) {
  const normalizedPath =
    requiredText(
      zipPath,
      "zipPath",
    );

  const input =
    createReadStream(
      normalizedPath,
    );

  yield* parseEdrZipStream(
    input,
    options,
  );
}
