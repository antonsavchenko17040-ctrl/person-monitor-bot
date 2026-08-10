import test from "node:test";
import assert from "node:assert/strict";

import {
  EDR_NORMALIZED_SCHEMA_VERSION,
  EDR_RECORD_TYPES,
  normalizeEdrOrganizationSubject,
  normalizeEdrFopSubject,
  normalizeEdrSubject,
} from "../src/edr-normalizer.js";

test(
  "exports canonical EDR model constants",
  () => {
    assert.equal(
      EDR_NORMALIZED_SCHEMA_VERSION,
      "edr-normalized-v1",
    );

    assert.deepEqual(
      EDR_RECORD_TYPES,
      {
        ORGANIZATION:
          "organization",
        FOP:
          "fop",
      },
    );
  },
);

test(
  "normalizes core UO fields",
  () => {
    const result =
      normalizeEdrOrganizationSubject({
        RECORD: " 42 ",
        NAME:
          " ТОВ Приклад ",
        SHORT_NAME:
          " ТОВ П ",
        OPF:
          " Товариство ",
        EDRPOU:
          " 12 345 678 ",
        STAN:
          " зареєстровано ",
        REGISTRATION:
          " 01.01.2020 ",
        FOUNDING_DOCUMENT_NUM:
          " 123 ",
        EXECUTIVE_POWER: {
          NAME:
            " Міністерство ",
          CODE:
            " 999 ",
        },
        PURPOSE:
          " Діяльність ",
      });

    assert.equal(
      result.schema_version,
      "edr-normalized-v1",
    );

    assert.equal(
      result.record_type,
      "organization",
    );

    assert.equal(
      result.record_number,
      "42",
    );

    assert.equal(
      result.name,
      "ТОВ Приклад",
    );

    assert.equal(
      result.short_name,
      "ТОВ П",
    );

    assert.equal(
      result.edrpou,
      "12345678",
    );

    assert.equal(
      result.legal_form,
      "Товариство",
    );

    assert.equal(
      result.status,
      "зареєстровано",
    );

    assert.deepEqual(
      result.executive_power,
      {
        name:
          "Міністерство",
        code:
          "999",
      },
    );
  },
);

test(
  "normalizes repeated UO person and organization strings",
  () => {
    const result =
      normalizeEdrOrganizationSubject({
        FOUNDERS: {
          FOUNDER: [
            " Іваненко Іван ",
            " ТОВ Засновник ",
          ],
        },
        BENEFICIARIES: {
          BENEFICIARY: [
            " Петренко Петро ",
            " Сидоренко Олена ",
          ],
        },
        SIGNERS: {
          SIGNER:
            " Директор Один ",
        },
        MEMBERS: {
          MEMBER: [
            " Учасник 1 ",
            " Учасник 2 ",
          ],
        },
      });

    assert.deepEqual(
      result.founders,
      [
        "Іваненко Іван",
        "ТОВ Засновник",
      ],
    );

    assert.deepEqual(
      result.beneficiaries,
      [
        "Петренко Петро",
        "Сидоренко Олена",
      ],
    );

    assert.deepEqual(
      result.signers,
      [
        "Директор Один",
      ],
    );

    assert.deepEqual(
      result.members,
      [
        "Учасник 1",
        "Учасник 2",
      ],
    );
  },
);

test(
  "normalizes branches predecessors and assignees",
  () => {
    const result =
      normalizeEdrOrganizationSubject({
        BRANCHES: {
          BRANCH: [
            {
              CODE:
                "001",
              NAME:
                " Київська філія ",
              SIGNER:
                " Керівник ",
              CREATE_DATE:
                "2020-01-01",

              EXCHANGE_DATA: {
                EXCHANGE_ANSWER: {
                  TAX_PAYER_TYPE:
                    "3",

                  START_DATE:
                    "2022-02-02",
                },
              },
            },
            {
              CODE:
                "002",
              NAME:
                " Львівська філія ",
            },
          ],
        },

        PREDECESSORS: {
          PREDECESSOR: [
            {
              NAME:
                " Попередник ",
              CODE:
                "11111111",
            },
          ],
        },

        ASSIGNEES: {
          ASSIGNEE: [
            {
              NAME:
                " Правонаступник ",
              CODE:
                "22222222",
            },
          ],
        },
      });

    assert.equal(
      result.branches.length,
      2,
    );

    assert.deepEqual(
      result.branches[0],
      {
        code:
          "001",
        name:
          "Київська філія",
        signer:
          "Керівник",
        create_date:
          "2020-01-01",

        exchange_answers: [
          {
            tax_payer_type:
              "3",

            start_date:
              "2022-02-02",

            start_number:
              null,

            end_date:
              null,

            end_number:
              null,
          },
        ],
      },
    );

    assert.deepEqual(
      result.predecessors,
      [
        {
          name:
            "Попередник",
          code:
            "11111111",
        },
      ],
    );

    assert.deepEqual(
      result.assignees,
      [
        {
          name:
            "Правонаступник",
          code:
            "22222222",
        },
      ],
    );
  },
);

test(
  "normalizes termination and bankruptcy data",
  () => {
    const result =
      normalizeEdrOrganizationSubject({
        TERMINATION_STARTED_INFO: {
          OP_DATE:
            "2025-01-01",
          REASON:
            " рішення ",
          SBJ_STATE:
            " припинення ",
          SIGNER_NAME:
            " Ліквідатор ",
          CREDITOR_REQ_END_DATE:
            "2025-03-01",
        },

        BANKRUPTCY_READJUSTMENT_INFO: {
          OP_DATE:
            "2024-01-01",
          REASON:
            " справа ",
          SBJ_STATE:
            " санація ",
          BANKRUPTCY_READJUSTMENT_HEAD_NAME:
            " Арбітражний керуючий ",
        },

        TERMINATED_INFO:
          " припинено ",
        TERMINATION_CANCEL_INFO:
          " скасовано ",
      });

    assert.deepEqual(
      result.termination_started,
      {
        operation_date:
          "2025-01-01",
        reason:
          "рішення",
        subject_state:
          "припинення",
        signer_name:
          "Ліквідатор",
        creditor_requirements_end_date:
          "2025-03-01",
      },
    );

    assert.deepEqual(
      result.bankruptcy_readjustment,
      {
        operation_date:
          "2024-01-01",
        reason:
          "справа",
        subject_state:
          "санація",
        head_name:
          "Арбітражний керуючий",
      },
    );

    assert.equal(
      result.terminated_info,
      "припинено",
    );

    assert.equal(
      result.termination_cancel_info,
      "скасовано",
    );
  },
);

test(
  "normalizes EDR exchange answers",
  () => {
    const result =
      normalizeEdrOrganizationSubject({
        EXCHANGE_DATA: {
          EXCHANGE_ANSWER: [
            {
              TAX_PAYER_TYPE:
                "1",
              START_DATE:
                "2020-01-01",
              START_NUM:
                "ABC",
            },
            {
              TAX_PAYER_TYPE:
                "2",
              END_DATE:
                "2025-01-01",
              END_NUM:
                "XYZ",
            },
          ],
        },
      });

    assert.deepEqual(
      result.exchange_answers,
      [
        {
          tax_payer_type:
            "1",
          start_date:
            "2020-01-01",
          start_number:
            "ABC",
          end_date:
            null,
          end_number:
            null,
        },
        {
          tax_payer_type:
            "2",
          start_date:
            null,
          start_number:
            null,
          end_date:
            "2025-01-01",
          end_number:
            "XYZ",
        },
      ],
    );
  },
);

test(
  "normalizes FOP into canonical EDR model",
  () => {
    const result =
      normalizeEdrFopSubject({
        RECORD:
          "500",
        NAME:
          " Іваненко Іван Іванович ",
        STAN:
          " зареєстровано ",
        FARMER:
          " так ",
        ESTATE_MANAGER:
          " ні ",
        REGISTRATION:
          "01.02.2020",
        TERMINATED_INFO:
          " ",
      });

    assert.equal(
      result.record_type,
      EDR_RECORD_TYPES.FOP,
    );

    assert.equal(
      result.record_number,
      "500",
    );

    assert.equal(
      result.name,
      "Іваненко Іван Іванович",
    );

    assert.equal(
      result.farmer,
      "так",
    );

    assert.equal(
      result.estate_manager,
      "ні",
    );

    assert.equal(
      result.edrpou,
      null,
    );

    assert.deepEqual(
      result.founders,
      [],
    );

    assert.equal(
      result.terminated_info,
      null,
    );
  },
);

test(
  "dispatches EDR normalization by record type",
  () => {
    assert.equal(
      normalizeEdrSubject(
        {
          NAME:
            "ТОВ Тест",
        },
        {
          recordType:
            " UO ",
        },
      ).record_type,
      "organization",
    );

    assert.equal(
      normalizeEdrSubject(
        {
          NAME:
            "ФОП Тест",
        },
        {
          recordType:
            "fop",
        },
      ).record_type,
      "fop",
    );

    assert.throws(
      () =>
        normalizeEdrSubject(
          {},
          {
            recordType:
              "unknown",
          },
        ),
      /Unsupported EDR record type/,
    );
  },
);
