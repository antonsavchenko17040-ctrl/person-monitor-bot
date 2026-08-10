import test from "node:test";
import assert from "node:assert/strict";

import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  normalizeEdrZipFile,
  normalizeEdrZipStream,
} from "../src/edr-pipeline.js";

const MULTI_SUBJECT_ZIP =
  "UEsDBBQAAAAIACKYCl2HcuC0CwAAAAkAAAAKAAAAUkVBRE1FLnR4dMtMz8svSlXITQUAUEsDBBQAAAAIACKYCl2kGUTcSwAAAI0AAAALAAAAZGF0YS9VTy54bWyzcXEMcbSzCQ518nJ1DrGzCXJ19g9ysTO00YeybPwcfV3tLiy6MO/CJAUgseXCjgt7bfTBojb6cH3oBhjhMGDKhU0XNmBq1wc7AwBQSwECFAMUAAAACAAimApdh3LgtAsAAAAJAAAACgAAAAAAAAAAAAAAgAEAAAAAUkVBRE1FLnR4dFBLAQIUAxQAAAAIACKYCl2kGUTcSwAAAI0AAAALAAAAAAAAAAAAAACAATMAAABkYXRhL1VPLnhtbFBLBQYAAAAAAgACAHEAAACnAAAAAAA=";

function zipBuffer() {
  return Buffer.from(
    MULTI_SUBJECT_ZIP,
    "base64",
  );
}

async function collect(
  iterable,
) {
  const result = [];

  for await (
    const item of iterable
  ) {
    result.push(
      item,
    );
  }

  return result;
}

test(
  "streams normalized organization records from EDR ZIP",
  async () => {
    const records =
      await collect(
        normalizeEdrZipStream(
          zipBuffer(),
          {
            recordType:
              "uo",
          },
        ),
      );

    assert.equal(
      records.length,
      2,
    );

    assert.deepEqual(
      records.map(
        (record) =>
          record.record_number,
      ),
      [
        "1",
        "2",
      ],
    );

    assert.deepEqual(
      records.map(
        (record) =>
          record.name,
      ),
      [
        "ТОВ Один",
        "ТОВ Два",
      ],
    );

    assert.ok(
      records.every(
        (record) =>
          record.record_type ===
            "organization",
      ),
    );

    assert.ok(
      records.every(
        (record) =>
          record.schema_version ===
            "edr-normalized-v1",
      ),
    );
  },
);

test(
  "streams normalized FOP records from EDR ZIP",
  async () => {
    const records =
      await collect(
        normalizeEdrZipStream(
          zipBuffer(),
          {
            recordType:
              "fop",
          },
        ),
      );

    assert.equal(
      records.length,
      2,
    );

    assert.ok(
      records.every(
        (record) =>
          record.record_type ===
            "fop",
      ),
    );

    assert.equal(
      records[0].record_number,
      "1",
    );

    assert.equal(
      records[0].name,
      "ТОВ Один",
    );

    assert.equal(
      records[0].edrpou,
      null,
    );
  },
);

test(
  "passes ZIP entry callback through pipeline",
  async () => {
    const entries = [];

    await collect(
      normalizeEdrZipStream(
        zipBuffer(),
        {
          recordType:
            "organization",

          onXmlEntry:
            async (entry) => {
              entries.push(
                entry,
              );
            },
        },
      ),
    );

    assert.deepEqual(
      entries,
      [
        {
          path:
            "data/UO.xml",

          name:
            "UO.xml",

          index: 1,
        },
      ],
    );
  },
);

test(
  "normalizes EDR ZIP file from disk",
  async () => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          "person-monitor-edr-pipeline-",
        ),
      );

    const zipPath =
      join(
        directory,
        "UO.zip",
      );

    try {
      await writeFile(
        zipPath,
        zipBuffer(),
      );

      const records =
        await collect(
          normalizeEdrZipFile(
            zipPath,
            {
              recordType:
                "uo",
            },
          ),
        );

      assert.equal(
        records.length,
        2,
      );

      assert.equal(
        records[0].record_type,
        "organization",
      );

      assert.equal(
        records[1].record_number,
        "2",
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

test(
  "rejects unsupported EDR record type before parsing",
  async () => {
    await assert.rejects(
      async () => {
        await collect(
          normalizeEdrZipStream(
            zipBuffer(),
            {
              recordType:
                "unknown",
            },
          ),
        );
      },
      /Unsupported EDR record type/,
    );
  },
);
