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
  isEdrXmlZipEntry,
  parseEdrZipFile,
  parseEdrZipStream,
} from "../src/edr-zip-parser.js";

const MULTI_SUBJECT_ZIP =
  "UEsDBBQAAAAIACKYCl2HcuC0CwAAAAkAAAAKAAAAUkVBRE1FLnR4dMtMz8svSlXITQUAUEsDBBQAAAAIACKYCl2kGUTcSwAAAI0AAAALAAAAZGF0YS9VTy54bWyzcXEMcbSzCQ518nJ1DrGzCXJ19g9ysTO00YeybPwcfV3tLiy6MO/CJAUgseXCjgt7bfTBojb6cH3oBhjhMGDKhU0XNmBq1wc7AwBQSwECFAMUAAAACAAimApdh3LgtAsAAAAJAAAACgAAAAAAAAAAAAAAgAEAAAAAUkVBRE1FLnR4dFBLAQIUAxQAAAAIACKYCl2kGUTcSwAAAI0AAAALAAAAAAAAAAAAAACAATMAAABkYXRhL1VPLnhtbFBLBQYAAAAAAgACAHEAAACnAAAAAAA=";

const TWO_XML_ZIP =
  "UEsDBBQAAAAIACKYCl1W+GnHPQAAAEwAAAAFAAAAYS54bWyzcXEMcbSzCQ518nJ1DrGzCXJ19g9ysTM0sNGHMm38HH1d7S7Mv7D1YsPFjgs7Luy00QcL2ejDdemDTQEAUEsDBBQAAAAIACKYCl3s0rQJPQAAAEwAAAAMAAAAbmVzdGVkL2IuWE1Ms3FxDHG0swkOdfJydQ6xswlydfYPcrEzMrDRhzJt/Bx9Xe0uTLnYcLH5wuYLOy7stNEHC9now3Xpg00BAFBLAQIUAxQAAAAIACKYCl1W+GnHPQAAAEwAAAAFAAAAAAAAAAAAAACAAQAAAABhLnhtbFBLAQIUAxQAAAAIACKYCl3s0rQJPQAAAEwAAAAMAAAAAAAAAAAAAACAAWAAAABuZXN0ZWQvYi5YTUxQSwUGAAAAAAIAAgBtAAAAxwAAAAAA";

const NO_XML_ZIP =
  "UEsDBBQAAAAIACKYCl2HcuC0CwAAAAkAAAAKAAAAUkVBRE1FLnR4dMtMz8svSlXITQUAUEsBAhQDFAAAAAgAIpgKXYdy4LQLAAAACQAAAAoAAAAAAAAAAAAAAIABAAAAAFJFQURNRS50eHRQSwUGAAAAAAEAAQA4AAAAMwAAAAAA";

const NO_SUBJECT_ZIP =
  "UEsDBBQAAAAIACKYCl0/4gOFFwAAAB0AAAAMAAAAZGF0YS9GT1AueG1ss3FxDHG0s3H1DQiJtDO00YcwbPTBwgBQSwECFAMUAAAACAAimApdP+IDhRcAAAAdAAAADAAAAAAAAAAAAAAAgAEAAAAAZGF0YS9GT1AueG1sUEsFBgAAAAABAAEAOgAAAEEAAAAAAA==";

function zipBuffer(
  base64,
) {
  return Buffer.from(
    base64,
    "base64",
  );
}

async function collectSubjects(
  input,
  options,
) {
  const subjects = [];

  for await (
    const subject of
      parseEdrZipStream(
        input,
        options,
      )
  ) {
    subjects.push(
      subject,
    );
  }

  return subjects;
}

test(
  "detects XML ZIP entries",
  () => {
    assert.equal(
      isEdrXmlZipEntry({
        type: "File",
        path: "data/UO.xml",
      }),
      true,
    );

    assert.equal(
      isEdrXmlZipEntry({
        type: "File",
        path: "nested/FOP.XML",
      }),
      true,
    );

    assert.equal(
      isEdrXmlZipEntry({
        type: "File",
        path: "README.txt",
      }),
      false,
    );

    assert.equal(
      isEdrXmlZipEntry({
        type: "Directory",
        path: "data/",
      }),
      false,
    );
  },
);

test(
  "streams SUBJECT records directly from ZIP",
  async () => {
    const entries = [];

    const subjects =
      await collectSubjects(
        zipBuffer(
          MULTI_SUBJECT_ZIP,
        ),
        {
          onXmlEntry:
            async (entry) => {
              entries.push(
                entry,
              );
            },
        },
      );

    assert.equal(
      subjects.length,
      2,
    );

    assert.deepEqual(
      subjects.map(
        (subject) =>
          subject.RECORD,
      ),
      [
        "1",
        "2",
      ],
    );

    assert.deepEqual(
      subjects.map(
        (subject) =>
          subject.NAME,
      ),
      [
        "ТОВ Один",
        "ТОВ Два",
      ],
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
  "streams records from multiple XML entries",
  async () => {
    const subjects =
      await collectSubjects(
        zipBuffer(
          TWO_XML_ZIP,
        ),
      );

    assert.deepEqual(
      subjects.map(
        (subject) =>
          subject.RECORD,
      ),
      [
        "10",
        "20",
      ],
    );

    assert.deepEqual(
      subjects.map(
        (subject) =>
          subject.NAME,
      ),
      [
        "Перший",
        "Другий",
      ],
    );
  },
);

test(
  "parses EDR ZIP file from disk",
  async () => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          "person-monitor-edr-zip-",
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
        zipBuffer(
          MULTI_SUBJECT_ZIP,
        ),
      );

      const subjects = [];

      for await (
        const subject of
          parseEdrZipFile(
            zipPath,
          )
      ) {
        subjects.push(
          subject,
        );
      }

      assert.equal(
        subjects.length,
        2,
      );

      assert.equal(
        subjects[0].RECORD,
        "1",
      );

      assert.equal(
        subjects[1].RECORD,
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
  "rejects ZIP without XML",
  async () => {
    await assert.rejects(
      async () => {
        for await (
          const subject of
            parseEdrZipStream(
              zipBuffer(
                NO_XML_ZIP,
              ),
            )
        ) {
          void subject;
        }
      },
      /contains no XML file/,
    );
  },
);

test(
  "rejects ZIP without SUBJECT",
  async () => {
    await assert.rejects(
      async () => {
        for await (
          const subject of
            parseEdrZipStream(
              zipBuffer(
                NO_SUBJECT_ZIP,
              ),
            )
        ) {
          void subject;
        }
      },
      /contains no SUBJECT element/,
    );
  },
);
