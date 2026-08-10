import test from "node:test";
import assert from "node:assert/strict";

import {
  Readable,
} from "node:stream";

import {
  parseEdrSubjectXmlStream,
  parseSingleEdrSubjectXml,
} from "../src/edr-xml-parser.js";

async function collectSubjects(
  input,
  options,
) {
  const subjects = [];

  for await (
    const subject of
      parseEdrSubjectXmlStream(
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
  "parses FOP SUBJECT fields",
  async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DATA>
  <SUBJECT>
    <RECORD>1</RECORD>
    <NAME>Іваненко Іван Іванович</NAME>
    <STAN>зареєстровано</STAN>
    <FARMER>ні</FARMER>
    <REGISTRATION>01.01.2020</REGISTRATION>
  </SUBJECT>
</DATA>`;

    const subject =
      await parseSingleEdrSubjectXml(
        xml,
      );

    assert.deepEqual(
      subject,
      {
        RECORD: "1",
        NAME:
          "Іваненко Іван Іванович",
        STAN:
          "зареєстровано",
        FARMER: "ні",
        REGISTRATION:
          "01.01.2020",
      },
    );
  },
);

test(
  "parses nested UO repeated relations",
  async () => {
    const xml = `<DATA>
  <SUBJECT>
    <RECORD>42</RECORD>
    <NAME>ТОВ ТЕСТ</NAME>
    <EDRPOU>12345678</EDRPOU>
    <FOUNDERS>
      <FOUNDER>Іваненко Іван Іванович</FOUNDER>
      <FOUNDER>ТОВ ЗАСНОВНИК</FOUNDER>
    </FOUNDERS>
    <BENEFICIARIES>
      <BENEFICIARY>Петренко Петро Петрович</BENEFICIARY>
      <BENEFICIARY>Сидоренко Олена Іванівна</BENEFICIARY>
    </BENEFICIARIES>
  </SUBJECT>
</DATA>`;

    const subject =
      await parseSingleEdrSubjectXml(
        xml,
      );

    assert.equal(
      subject.RECORD,
      "42",
    );

    assert.equal(
      subject.EDRPOU,
      "12345678",
    );

    assert.deepEqual(
      subject.FOUNDERS,
      {
        FOUNDER: [
          "Іваненко Іван Іванович",
          "ТОВ ЗАСНОВНИК",
        ],
      },
    );

    assert.deepEqual(
      subject.BENEFICIARIES,
      {
        BENEFICIARY: [
          "Петренко Петро Петрович",
          "Сидоренко Олена Іванівна",
        ],
      },
    );
  },
);

test(
  "parses nested complex UO structures",
  async () => {
    const xml = `<DATA>
  <SUBJECT>
    <RECORD>7</RECORD>
    <NAME>ПРИКЛАД ЮО</NAME>
    <BRANCHES>
      <BRANCH>
        <CODE>001</CODE>
        <NAME>Київська філія</NAME>
        <SIGNER>Керівник Один</SIGNER>
      </BRANCH>
      <BRANCH>
        <CODE>002</CODE>
        <NAME>Львівська філія</NAME>
        <SIGNER>Керівник Два</SIGNER>
      </BRANCH>
    </BRANCHES>
    <EXCHANGE_DATA>
      <EXCHANGE_ANSWER>
        <TAX_PAYER_TYPE>1</TAX_PAYER_TYPE>
        <START_DATE>2020-01-01</START_DATE>
      </EXCHANGE_ANSWER>
      <EXCHANGE_ANSWER>
        <TAX_PAYER_TYPE>2</TAX_PAYER_TYPE>
        <START_DATE>2021-02-03</START_DATE>
      </EXCHANGE_ANSWER>
    </EXCHANGE_DATA>
  </SUBJECT>
</DATA>`;

    const subject =
      await parseSingleEdrSubjectXml(
        xml,
      );

    assert.equal(
      subject.BRANCHES
        .BRANCH.length,
      2,
    );

    assert.deepEqual(
      subject.BRANCHES
        .BRANCH[0],
      {
        CODE: "001",
        NAME:
          "Київська філія",
        SIGNER:
          "Керівник Один",
      },
    );

    assert.equal(
      subject.EXCHANGE_DATA
        .EXCHANGE_ANSWER.length,
      2,
    );

    assert.equal(
      subject.EXCHANGE_DATA
        .EXCHANGE_ANSWER[1]
        .TAX_PAYER_TYPE,
      "2",
    );
  },
);

test(
  "streams multiple SUBJECT records",
  async () => {
    const xml = `<DATA>
  <SUBJECT>
    <RECORD>1</RECORD>
    <NAME>Перший</NAME>
  </SUBJECT>
  <SUBJECT>
    <RECORD>2</RECORD>
    <NAME>Другий</NAME>
  </SUBJECT>
  <SUBJECT>
    <RECORD>3</RECORD>
    <NAME>Третій</NAME>
  </SUBJECT>
</DATA>`;

    const subjects =
      await collectSubjects(
        xml,
      );

    assert.deepEqual(
      subjects.map(
        (subject) =>
          subject.RECORD,
      ),
      [
        "1",
        "2",
        "3",
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
        "Третій",
      ],
    );
  },
);

test(
  "preserves UTF-8 text split across chunks",
  async () => {
    const xml =
      Buffer.from(
        `<DATA><SUBJECT><RECORD>1</RECORD><NAME>Київський підприємець</NAME></SUBJECT></DATA>`,
        "utf8",
      );

    const marker =
      Buffer.from(
        "ї",
        "utf8",
      );

    const position =
      xml.indexOf(
        marker,
      );

    assert.ok(
      position > 0,
    );

    const source =
      Readable.from([
        xml.subarray(
          0,
          position + 1,
        ),
        xml.subarray(
          position + 1,
        ),
      ]);

    const subject =
      await parseSingleEdrSubjectXml(
        source,
      );

    assert.equal(
      subject.NAME,
      "Київський підприємець",
    );
  },
);

test(
  "requires SUBJECT when requested",
  async () => {
    await assert.rejects(
      async () => {
        for await (
          const subject of
            parseEdrSubjectXmlStream(
              "<DATA></DATA>",
              {
                requireSubject:
                  true,
              },
            )
        ) {
          void subject;
        }
      },
      /contains no SUBJECT/,
    );
  },
);
