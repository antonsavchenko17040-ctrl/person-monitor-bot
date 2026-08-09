import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeterministicAnalyticsAnswer,
  buildDeterministicCashAssetAnswer,
  buildDeterministicDeclarationSubmissionAnswer,
  buildDeterministicEmploymentAnswer,
  buildDeterministicFamilyMemberAnswer,
  buildDeterministicIncomeDetailAnswer,
  buildDeterministicRealEstateAnswer,
  buildDeterministicSubjectProfileAnswer,
  buildDeterministicVehicleAnswer,
  buildDeterministicOrganizationRelationsAnswer,
  buildModelContext,
  buildResponsesRequest,
  createSubjectChatResponse,
  normalizeChatHistory,
  questionNeedsSourceTool,
  resolveContextualQuestion,
} from "../src/chat-service.js";

test(
  "normalizes chat history",
  () => {
    const history =
      normalizeChatHistory([
        {
          role: "system",
          content: "ignore",
        },
        {
          role: "user",
          content: "Перше питання",
        },
        {
          role: "assistant",
          content: "Перша відповідь",
        },
      ]);

    assert.equal(
      history.length,
      2,
    );

    assert.equal(
      history[0].role,
      "user",
    );

    assert.equal(
      history[1].role,
      "assistant",
    );
  },
);

test(
  "inherits topic but replaces year in follow-up question",
  () => {
    const resolved =
      resolveContextualQuestion(
        "А за 2024?",
        [
          {
            role:
              "user",

            content:
              "Який дохід у 2025 році?",
          },
          {
            role:
              "assistant",

            content:
              "Попередня відповідь AI не повинна бути retrieval-джерелом.",
          },
        ]
      );

    assert.match(
      resolved,
      /дохід/i,
    );

    assert.match(
      resolved,
      /2024/,
    );

    assert.doesNotMatch(
      resolved,
      /2025/,
    );

    assert.doesNotMatch(
      resolved,
      /Попередня відповідь AI/,
    );
  },
);

test(
  "inherits topic and year for ambiguous detail follow-up",
  () => {
    const resolved =
      resolveContextualQuestion(
        "А які джерела?",
        [
          {
            role:
              "user",

            content:
              "Який дохід у 2025 році?",
          },
        ]
      );

    assert.match(
      resolved,
      /дохід/i,
    );

    assert.match(
      resolved,
      /2025/,
    );

    assert.match(
      resolved,
      /джерела/i,
    );
  },
);

test(
  "inherits only year when follow-up changes domain",
  () => {
    const resolved =
      resolveContextualQuestion(
        "А яка нерухомість?",
        [
          {
            role:
              "user",

            content:
              "Який дохід у 2025 році?",
          },
        ]
      );

    assert.match(
      resolved,
      /2025/,
    );

    assert.match(
      resolved,
      /нерухом/i,
    );

    assert.doesNotMatch(
      resolved,
      /дохід/i,
    );
  },
);

test(
  "compacts and scopes declarant real estate model context",
  () => {
    const context =
      buildModelContext(
        {
          subject: {
            full_name:
              "Тестова Особа",
          },

          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "real_estate",

              value_text:
                "Квартира",

              value_number:
                100,

              unit:
                "m2",

              metadata: {
                declaration_year:
                  2025,

                VERY_LARGE_METADATA:
                  "SHOULD_NOT_REACH_MODEL",
              },

              value_json: {
                object_type:
                  "Квартира",

                total_area:
                  100,

                region:
                  "Київ",

                acquisition_date:
                  "01.01.2020",

                VERY_LARGE_RAW_FIELD:
                  "SHOULD_NOT_REACH_MODEL",

                rights: [
                  {
                    actor: {
                      role:
                        "declarant",

                      name:
                        "Тестова Особа",

                      relation:
                        "декларант",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },

              source_document_id:
                "doc-1",
            },

            {
              fact_type:
                "real_estate",

              value_text:
                "Будинок",

              value_number:
                200,

              unit:
                "m2",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                object_type:
                  "Будинок",

                total_area:
                  200,

                region:
                  "Київ",

                rights: [
                  {
                    actor: {
                      role:
                        "family",

                      name:
                        "Член сім'ї",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },
          ],

          relations: [
            {
              relation_type:
                "BIG_RELATION_SHOULD_NOT_APPEAR",
            },
          ],

          mentions: [
            {
              title:
                "BIG_MENTION_SHOULD_NOT_APPEAR",
            },
          ],

          cross_checks: [
            {
              check_type:
                "BIG_CROSSCHECK_SHOULD_NOT_APPEAR",
            },
          ],

          source_documents: [
            {
              id:
                "doc-1",

              url:
                "https://example.test/doc-1",
            },
          ],

          analytics: null,

          counts: {},
        },

        "Яку нерухомість декларант мав у 2025 році?"
      );

    const serialized =
      JSON.stringify(
        context
      );

    assert.equal(
      context.facts.length,
      1,
    );

    assert.equal(
      context.facts[0]
        .object_type,
      "Квартира",
    );

    assert.equal(
      context.facts[0]
        .area,
      100,
    );

    assert.equal(
      context.facts[0]
        .rights[0]
        .role,
      "declarant",
    );

    assert.doesNotMatch(
      serialized,
      /SHOULD_NOT_REACH_MODEL/,
    );

    assert.doesNotMatch(
      serialized,
      /BIG_RELATION_SHOULD_NOT_APPEAR/,
    );

    assert.doesNotMatch(
      serialized,
      /BIG_MENTION_SHOULD_NOT_APPEAR/,
    );

    assert.doesNotMatch(
      serialized,
      /BIG_CROSSCHECK_SHOULD_NOT_APPEAR/,
    );
  },
);

test(
  "keeps compact relations for explicit relation question",
  () => {
    const context =
      buildModelContext(
        {
          subject: {
            full_name:
              "Тестова Особа",
          },

          detected_years:
            [],

          facts: [],

          relations: [
            {
              relation_type:
                "employed_by",

              relation_scope:
                "direct",

              from_name:
                "Тестова Особа",

              from_entity_type:
                "person",

              to_name:
                "Тестова Організація",

              to_entity_type:
                "organization",

              metadata: {
                HUGE_INTERNAL:
                  "DO_NOT_INCLUDE",
              },
            },
          ],

          mentions: [],
          cross_checks: [],
          source_documents: [],
          analytics: null,
          counts: {},
        },

        "Які зв'язки має ця особа?"
      );

    const serialized =
      JSON.stringify(
        context
      );

    assert.equal(
      context.relations.length,
      1,
    );

    assert.match(
      serialized,
      /employed_by/,
    );

    assert.match(
      serialized,
      /Тестова Організація/,
    );

    assert.doesNotMatch(
      serialized,
      /DO_NOT_INCLUDE/,
    );
  },
);

test(
  "hides relation evidence metadata unless explicitly requested",
  () => {
    const base = {
      subject: {
        full_name:
          "Тестова Особа",
      },

      detected_years:
        [2025],

      facts: [],

      relations: [
        {
          relation_type:
            "third_party_rightsholder",

          relation_scope:
            "second_hop",

          from_entity_type:
            "asset",

          from_name:
            "Квартира",

          to_entity_type:
            "organization",

          to_name:
            "Тестова Організація",

          confidence:
            100,

          verification_status:
            "source_extracted",
        },
      ],

      mentions: [],
      cross_checks: [],
      source_documents: [],
      analytics: null,
      counts: {},
    };

    const ordinary =
      JSON.stringify(
        buildModelContext(
          base,
          "Які зв'язки з організаціями є у 2025 році?"
        )
      );

    assert.doesNotMatch(
      ordinary,
      /source_extracted/,
    );

    assert.doesNotMatch(
      ordinary,
      /"confidence":100/,
    );

    const evidence =
      JSON.stringify(
        buildModelContext(
          base,
          "Наскільки підтверджені ці зв'язки з організаціями?"
        )
      );

    assert.match(
      evidence,
      /source_extracted/,
    );

    assert.match(
      evidence,
      /"confidence":100/,
    );
  },
);

test(
  "hides internal relation source id for ordinary question",
  () => {
    const context =
      buildModelContext(
        {
          subject: {
            full_name:
              "Тестова Особа",
          },

          detected_years:
            [2025],

          facts: [],

          relations: [
            {
              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              from_entity_type:
                "asset",

              from_name:
                "Квартира",

              to_entity_type:
                "organization",

              to_name:
                "Тестова Організація",

              source_document_id:
                "INTERNAL-DOC-ID-123",
            },
          ],

          mentions: [],
          cross_checks: [],
          source_documents: [],
          analytics: null,
          counts: {},
        },

        "Які зв'язки з організаціями є у 2025 році?"
      );

    const serialized =
      JSON.stringify(context);

    assert.doesNotMatch(
      serialized,
      /INTERNAL-DOC-ID-123/,
    );
  },
);

test(
  "prioritizes organization relations for relation question",
  () => {
    const context =
      buildModelContext(
        {
          subject: {
            full_name:
              "Тестова Особа",
          },

          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "real_estate",

              value_text:
                "BIG IRRELEVANT FACT",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                object_type:
                  "Квартира",

                total_area:
                  100,

                rights: [],
              },
            },
          ],

          relations: [
            {
              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              from_entity_type:
                "asset",

              from_name:
                "Квартира",

              to_entity_type:
                "organization_observation",

              to_name:
                "Тестова Компанія",
            },

            {
              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              from_entity_type:
                "asset",

              from_name:
                "Квартира",

              to_entity_type:
                "person_observation",

              to_name:
                "Тестова Людина",
            },
          ],

          mentions: [],

          cross_checks: [],

          source_documents: [
            {
              id:
                "doc-1",

              source_type:
                "mention",

              title:
                "BIG SOURCE DOCUMENT",

              url:
                "https://example.test/doc",
            },
          ],

          analytics: null,

          counts: {},
        },

        "Які зв'язки з організаціями має декларант у 2025 році?"
      );

    const serialized =
      JSON.stringify(
        context
      );

    assert.equal(
      context.facts.length,
      0,
    );

    assert.equal(
      context.relations.length,
      1,
    );

    assert.equal(
      context.relations[0]
        .to_name,
      "Тестова Компанія",
    );

    assert.match(
      context.relations[0]
        .relation_label,
      /непрямий зв’язок/,
    );

    assert.equal(
      context.source_documents
        .length,
      0,
    );

    assert.doesNotMatch(
      serialized,
      /BIG IRRELEVANT FACT/,
    );

    assert.doesNotMatch(
      serialized,
      /Тестова Людина/,
    );

    assert.doesNotMatch(
      serialized,
      /BIG SOURCE DOCUMENT/,
    );
  },
);

test(
  "does not attach source tool to ordinary analytical question",
  () => {
    assert.equal(
      questionNeedsSourceTool(
        "Яку нерухомість декларант мав у 2025 році?"
      ),
      false,
    );
  },
);

test(
  "attaches source tool when full source is explicitly requested",
  () => {
    assert.equal(
      questionNeedsSourceTool(
        "Покажи повний документ декларації за 2025 рік"
      ),
      true,
    );
  },
);

test(
  "builds deterministic subject profile from Person Monitor subject card",
  () => {
    const answer =
      buildDeterministicSubjectProfileAnswer(
        "Покажи основну інформацію про суб’єкта",
        {
          subject: {
            full_name:
              "Тестовий Суб’єкт",

            organization:
              "Тестова Організація",

            position:
              "Тестова Посада",

            city:
              "Київ",
          },
        },
        {
          detected_years: [],
        }
      );

    assert.match(
      answer,
      /Картка суб’єкта Person Monitor/,
    );

    assert.match(
      answer,
      /\*\*ПІБ:\*\* Тестовий Суб’єкт/,
    );

    assert.match(
      answer,
      /\*\*Організація:\*\* Тестова Організація/,
    );

    assert.match(
      answer,
      /\*\*Посада:\*\* Тестова Посада/,
    );

    assert.match(
      answer,
      /\*\*Місто:\*\* Київ/,
    );
  },
);

test(
  "does not use current subject profile for year-specific question",
  () => {
    const answer =
      buildDeterministicSubjectProfileAnswer(
        "Яка посада була у 2025 році?",
        {
          subject: {
            full_name:
              "Тестовий Суб’єкт",

            organization:
              "Поточна Організація",

            position:
              "Поточна Посада",

            city:
              "Київ",
          },
        },
        {
          detected_years:
            [2025],
        }
      );

    assert.equal(
      answer,
      null,
    );
  },
);

test(
  "keeps analytical profile question on AI path",
  () => {
    const answer =
      buildDeterministicSubjectProfileAnswer(
        "Проаналізуй профіль суб’єкта та оціни ризики",
        {
          subject: {
            full_name:
              "Тестовий Суб’єкт",

            organization:
              "Тестова Організація",

            position:
              "Тестова Посада",

            city:
              "Київ",
          },
        },
        {
          detected_years: [],
        }
      );

    assert.equal(
      answer,
      null,
    );
  },
);

test(
  "builds deterministic declaration submission list for one year",
  () => {
    const answer =
      buildDeterministicDeclarationSubmissionAnswer(
        "Які декларації були подані у 2025 році?",
        {
          detected_years:
            [2025],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-canonical",
              },
            ],
          },
        },

        [
          {
            fact_type:
              "declaration_submission",

            source_document_id:
              "doc-old",

            value_json: {
              declaration_year:
                2025,

              document_guid:
                "guid-old",

              url:
                "https://example.test/guid-old",

              registry:
                "Тестовий реєстр",

              published_at:
                "2025-10-03T18:11:33.000Z",
            },
          },

          {
            fact_type:
              "declaration_submission",

            source_document_id:
              "doc-canonical",

            value_json: {
              declaration_year:
                2025,

              document_guid:
                "guid-canonical",

              url:
                "https://example.test/guid-canonical",

              registry:
                "Тестовий реєстр",

              published_at:
                "2026-03-30T17:07:13.000Z",
            },
          },

          {
            fact_type:
              "declaration_submission",

            source_document_id:
              "doc-middle",

            value_json: {
              declaration_year:
                2025,

              document_guid:
                "guid-middle",

              url:
                "https://example.test/guid-middle",

              registry:
                "Тестовий реєстр",

              published_at:
                "2025-10-03T18:13:35.000Z",
            },
          },

          /*
           * Інший рік не повинен
           * потрапити у відповідь.
           */
          {
            fact_type:
              "declaration_submission",

            source_document_id:
              "doc-2024",

            value_json: {
              declaration_year:
                2024,

              document_guid:
                "guid-2024",

              url:
                "https://example.test/guid-2024",
            },
          },
        ]
      );

    assert.match(
      answer,
      /Декларації за 2025 рік: \*\*3\*\*/,
    );

    assert.match(
      answer,
      /guid-canonical/,
    );

    assert.match(
      answer,
      /guid-middle/,
    );

    assert.match(
      answer,
      /guid-old/,
    );

    assert.doesNotMatch(
      answer,
      /guid-2024/,
    );

    const canonicalIndex =
      answer.indexOf(
        "guid-canonical"
      );

    const middleIndex =
      answer.indexOf(
        "guid-middle"
      );

    const oldIndex =
      answer.indexOf(
        "guid-old"
      );

    assert.ok(
      canonicalIndex <
      middleIndex
    );

    assert.ok(
      middleIndex <
      oldIndex
    );

    const canonicalMarks =
      answer.match(
        /Основне джерело Person Monitor для аналітики цього року/g
      ) ?? [];

    assert.equal(
      canonicalMarks.length,
      1,
    );

    assert.match(
      answer,
      /https:\/\/example\.test\/guid-canonical/,
    );
  },
);

test(
  "deduplicates declaration submissions by document GUID",
  () => {
    const answer =
      buildDeterministicDeclarationSubmissionAnswer(
        "Скільки декларацій було подано у 2025 році?",
        {
          detected_years:
            [2025],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-one",
              },
            ],
          },
        },

        [
          {
            fact_type:
              "declaration_submission",

            source_document_id:
              "doc-one",

            value_json: {
              declaration_year:
                2025,

              document_guid:
                "same-guid",

              url:
                "https://example.test/same-guid",

              published_at:
                "2026-03-30T17:07:13.000Z",
            },
          },

          {
            fact_type:
              "declaration_submission",

            source_document_id:
              "doc-copy",

            value_json: {
              declaration_year:
                2025,

              document_guid:
                "same-guid",

              url:
                "https://example.test/same-guid-copy",

              published_at:
                "2026-03-30T17:07:13.000Z",
            },
          },
        ]
      );

    assert.match(
      answer,
      /Декларації за 2025 рік: \*\*1\*\*/,
    );

    const matches =
      answer.match(
        /same-guid/g
      ) ?? [];

    /*
     * GUID є один раз у заголовку
     * одного запису; URL теж може
     * містити цей текст, тому
     * перевіряємо кількість рядків.
     */
    const numberedRows =
      answer
        .split("\n")
        .filter(
          (line) =>
            /^\d+\.\s/.test(
              line.trim()
            )
        );

    assert.equal(
      numberedRows.length,
      1,
    );

    assert.ok(
      matches.length >= 1
    );
  },
);

test(
  "keeps analytical declaration question on AI path",
  () => {
    const answer =
      buildDeterministicDeclarationSubmissionAnswer(
        "Проаналізуй декларації за 2024 та 2025 роки і поясни зміни",
        {
          detected_years:
            [2024, 2025],

          analytics: {
            yearly: [],
          },
        },

        [
          {
            fact_type:
              "declaration_submission",

            source_document_id:
              "doc-2025",

            value_json: {
              declaration_year:
                2025,

              document_guid:
                "guid-2025",

              url:
                "https://example.test/guid-2025",
            },
          },
        ]
      );

    assert.equal(
      answer,
      null,
    );
  },
);

test(
  "builds deterministic employment answer from canonical document",
  () => {
    const answer =
      buildDeterministicEmploymentAnswer(
        "Яку посаду обіймав декларант у 2025 році?",
        {
          detected_years:
            [2025],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-canonical",
              },
            ],
          },

          source_documents: [
            {
              id:
                "doc-canonical",

              url:
                "https://example.test/declaration-2025",
            },
          ],
        },

        [
          {
            fact_type:
              "employment",

            source_document_id:
              "doc-canonical",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              "ПРЕЗИДЕНТ УКРАЇНИ",

            value_json: {
              person: {
                role:
                  "declarant",

                name:
                  "Тестовий Декларант",
              },

              position:
                "ПРЕЗИДЕНТ УКРАЇНИ",

              workplace:
                "ПРЕЗИДЕНТ УКРАЇНИ",

              responsible_position_exact:
                "Президент України",
            },
          },

          /*
           * Інший документ того
           * самого року не повинен
           * потрапити у відповідь.
           */
          {
            fact_type:
              "employment",

            source_document_id:
              "doc-other",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              "ІНША ПОСАДА",

            value_json: {
              person: {
                role:
                  "declarant",
              },

              position:
                "ІНША ПОСАДА",

              workplace:
                "ІНША ОРГАНІЗАЦІЯ",
            },
          },

          /*
           * Employment іншої особи
           * у канонічному документі
           * також відсіюємо.
           */
          {
            fact_type:
              "employment",

            source_document_id:
              "doc-canonical",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              "ПОСАДА ЧЛЕНА СІМ’Ї",

            value_json: {
              person: {
                role:
                  "family",

                name:
                  "Тестовий Член Сім’ї",
              },

              position:
                "ПОСАДА ЧЛЕНА СІМ’Ї",

              workplace:
                "СТОРОННЯ УСТАНОВА",
            },
          },
        ]
      );

    assert.match(
      answer,
      /ПРЕЗИДЕНТ УКРАЇНИ/,
    );

    assert.match(
      answer,
      /Президент України/,
    );

    assert.match(
      answer,
      /Місце роботи \(як зазначено у декларації\)/,
    );

    assert.doesNotMatch(
      answer,
      /ІНША ПОСАДА/,
    );

    assert.doesNotMatch(
      answer,
      /ПОСАДА ЧЛЕНА СІМ’Ї/,
    );

    assert.match(
      answer,
      /https:\/\/example\.test\/declaration-2025/,
    );
  },
);

test(
  "recognizes feminine employment question wording",
  () => {
    const answer =
      buildDeterministicEmploymentAnswer(
        "Яка посада була у 2025 році?",
        {
          detected_years:
            [2025],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-canonical",
              },
            ],
          },

          source_documents: [
            {
              id:
                "doc-canonical",

              url:
                "https://example.test/declaration-2025",
            },
          ],
        },

        [
          {
            fact_type:
              "employment",

            source_document_id:
              "doc-canonical",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              "ТЕСТОВА ПОСАДА",

            value_json: {
              person: {
                role:
                  "declarant",
              },

              position:
                "ТЕСТОВА ПОСАДА",

              workplace:
                "ТЕСТОВА ОРГАНІЗАЦІЯ",
            },
          },
        ]
      );

    assert.match(
      answer,
      /Посада та місце роботи декларанта за 2025 рік/,
    );

    assert.match(
      answer,
      /ТЕСТОВА ПОСАДА/,
    );

    assert.match(
      answer,
      /https:\/\/example\.test\/declaration-2025/,
    );
  },
);

test(
  "requires canonical document for deterministic employment answer",
  () => {
    const answer =
      buildDeterministicEmploymentAnswer(
        "Де працював декларант у 2025 році?",
        {
          detected_years:
            [2025],

          analytics: {
            yearly: [
              {
                year:
                  2025,
              },
            ],
          },

          source_documents: [],
        },

        [
          {
            fact_type:
              "employment",

            source_document_id:
              "doc-random",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              "ТЕСТОВА ПОСАДА",

            value_json: {
              person: {
                role:
                  "declarant",
              },

              position:
                "ТЕСТОВА ПОСАДА",

              workplace:
                "ТЕСТОВА УСТАНОВА",
            },
          },
        ]
      );

    assert.equal(
      answer,
      null,
    );
  },
);

test(
  "keeps analytical employment question on AI path",
  () => {
    const answer =
      buildDeterministicEmploymentAnswer(
        "Покажи та проаналізуй посаду декларанта у 2025 році",
        {
          detected_years:
            [2025],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-canonical",
              },
            ],
          },

          source_documents: [],
        },

        [
          {
            fact_type:
              "employment",

            source_document_id:
              "doc-canonical",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              "ТЕСТОВА ПОСАДА",

            value_json: {
              person: {
                role:
                  "declarant",
              },

              position:
                "ТЕСТОВА ПОСАДА",

              workplace:
                "ТЕСТОВА УСТАНОВА",
            },
          },
        ]
      );

    assert.equal(
      answer,
      null,
    );
  },
);

test(
  "builds deterministic family member list from canonical document",
  () => {
    const answer =
      buildDeterministicFamilyMemberAnswer(
        "Хто входив до складу сім’ї декларанта у 2025 році?",
        {
          detected_years:
            [2025],

          facts: [],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-canonical",
              },
            ],
          },

          source_documents: [
            {
              id:
                "doc-canonical",

              url:
                "https://example.test/declaration-2025",
            },
          ],
        },

        [
          {
            fact_type:
              "family_member",

            source_document_id:
              "doc-canonical",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              "Тестова Дружина",

            value_json: {
              name:
                "Тестова Дружина",

              relation:
                "дружина",

              person_ref:
                "family-wife",
            },
          },

          {
            fact_type:
              "family_member",

            source_document_id:
              "doc-canonical",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              "Тестовий Син",

            value_json: {
              name:
                "Тестовий Син",

              relation:
                "син",

              person_ref:
                "family-son",
            },
          },

          /*
           * Інша декларація того
           * самого року не повинна
           * потрапити у відповідь.
           */
          {
            fact_type:
              "family_member",

            source_document_id:
              "doc-other",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              "Стороння Особа",

            value_json: {
              name:
                "Стороння Особа",

              relation:
                "інше",

              person_ref:
                "other-person",
            },
          },

          /*
           * Порожній family fact
           * не повинен створювати
           * фіктивного члена сім'ї.
           */
          {
            fact_type:
              "family_member",

            source_document_id:
              "doc-canonical",

            metadata: {
              declaration_year:
                2025,
            },

            value_text:
              null,

            value_json: {
              name:
                null,

              relation:
                null,

              person_ref:
                null,
            },
          },
        ]
      );

    assert.match(
      answer,
      /Тестова Дружина/,
    );

    assert.match(
      answer,
      /дружина/,
    );

    assert.match(
      answer,
      /Тестовий Син/,
    );

    assert.match(
      answer,
      /син/,
    );

    assert.doesNotMatch(
      answer,
      /Стороння Особа/,
    );

    assert.match(
      answer,
      /https:\/\/example\.test\/declaration-2025/,
    );
  },
);

test(
  "deduplicates family member inside canonical document",
  () => {
    const member = {
      fact_type:
        "family_member",

      source_document_id:
        "doc-canonical",

      metadata: {
        declaration_year:
          2020,
      },

      value_text:
        "Тестова Дружина",

      value_json: {
        name:
          "Тестова Дружина",

        relation:
          "дружина",

        person_ref:
          "family-wife",
      },
    };

    const answer =
      buildDeterministicFamilyMemberAnswer(
        "Які члени сім’ї були у 2020 році?",
        {
          detected_years:
            [2020],

          analytics: {
            yearly: [
              {
                year:
                  2020,

                sourceDocumentId:
                  "doc-canonical",
              },
            ],
          },

          source_documents: [],
        },

        [
          member,
          {
            ...member,

            fact_key:
              "duplicate-copy",
          },
        ]
      );

    const matches =
      answer.match(
        /Тестова Дружина/g
      ) ?? [];

    assert.equal(
      matches.length,
      1,
    );
  },
);

test(
  "keeps analytical family question on AI path",
  () => {
    const answer =
      buildDeterministicFamilyMemberAnswer(
        "Проаналізуй, як змінювався склад сім’ї у 2024 та 2025 роках",
        {
          detected_years:
            [2024, 2025],

          facts: [
            {
              fact_type:
                "family_member",

              metadata: {
                declaration_year:
                  2025,
              },

              value_text:
                "Тестова Дружина",

              value_json: {
                name:
                  "Тестова Дружина",

                relation:
                  "дружина",

                person_ref:
                  "family-wife",
              },
            },
          ],
        }
      );

    assert.equal(
      answer,
      null,
    );
  },
);

test(
  "builds deterministic declarant cash asset list",
  () => {
    const answer =
      buildDeterministicCashAssetAnswer(
        "Які грошові активи має декларант у 2025 році?",
        {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "cash_asset",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                asset_type:
                  "Кошти, розміщені на банківських рахунках",

                amount:
                  100000,

                currency:
                  "UAH",

                organization_name:
                  "ТЕСТОВИЙ БАНК",

                person: {
                  role:
                    "declarant",

                  name:
                    "Тестовий Декларант",

                  relation:
                    "декларант",
                },

                rights: [
                  {
                    actor: {
                      role:
                        "declarant",

                      name:
                        "Тестовий Декларант",

                      relation:
                        "декларант",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },

            {
              fact_type:
                "cash_asset",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                asset_type:
                  "Готівкові кошти",

                amount:
                  50000,

                currency:
                  "USD",

                person: {
                  role:
                    "family",

                  name:
                    "Тестова Дружина",

                  relation:
                    "дружина",
                },

                rights: [
                  {
                    actor: {
                      role:
                        "family",

                      name:
                        "Тестова Дружина",

                      relation:
                        "дружина",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },
          ],

          source_documents: [],

          analytics: {
            yearly: [],
          },
        }
      );

    assert.match(
      answer,
      /100 000 UAH/,
    );

    assert.match(
      answer,
      /ТЕСТОВИЙ БАНК/,
    );

    assert.match(
      answer,
      /Власність/,
    );

    assert.doesNotMatch(
      answer,
      /50 000 USD/,
    );
  },
);

test(
  "builds deterministic family cash asset list",
  () => {
    const answer =
      buildDeterministicCashAssetAnswer(
        "Які кошти членів сім’ї були задекларовані у 2025 році?",
        {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "cash_asset",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                asset_type:
                  "Готівкові кошти",

                amount:
                  595000,

                currency:
                  "USD",

                person: {
                  role:
                    "declarant",

                  name:
                    "Декларант",
                },

                rights: [
                  {
                    actor: {
                      role:
                        "declarant",

                      name:
                        "Декларант",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },

            {
              fact_type:
                "cash_asset",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                asset_type:
                  "Кошти, розміщені на банківських рахунках",

                amount:
                  15032,

                currency:
                  "EUR",

                organization_name:
                  "СІМЕЙНИЙ БАНК",

                person: {
                  role:
                    "family",

                  name:
                    "Тестова Дружина",

                  relation:
                    "дружина",
                },

                rights: [
                  {
                    actor: {
                      role:
                        "family",

                      name:
                        "Тестова Дружина",

                      relation:
                        "дружина",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },
          ],

          source_documents: [],

          analytics: {
            yearly: [],
          },
        }
      );

    assert.match(
      answer,
      /15 032 EUR/,
    );

    assert.match(
      answer,
      /Тестова Дружина \(дружина\)/,
    );

    assert.match(
      answer,
      /СІМЕЙНИЙ БАНК/,
    );

    assert.doesNotMatch(
      answer,
      /595 000 USD/,
    );
  },
);

test(
  "keeps joint cash ownership in deterministic household answer",
  () => {
    const answer =
      buildDeterministicCashAssetAnswer(
        "Які грошові активи декларанта і членів сім’ї були у 2020 році?",
        {
          detected_years:
            [2020],

          facts: [
            {
              fact_type:
                "cash_asset",

              metadata: {
                declaration_year:
                  2020,
              },

              value_json: {
                asset_type:
                  "Готівкові кошти",

                amount:
                  615000,

                currency:
                  "USD",

                person:
                  null,

                rights: [
                  {
                    actor: {
                      ref:
                        "1",

                      role:
                        "declarant",

                      name:
                        "Тестовий Декларант",

                      relation:
                        "декларант",
                    },

                    ownership_type:
                      "Спільна сумісна власність",
                  },

                  {
                    actor: {
                      ref:
                        "family-1",

                      role:
                        "family",

                      name:
                        "Тестова Дружина",

                      relation:
                        "дружина",
                    },

                    ownership_type:
                      "Спільна сумісна власність",
                  },
                ],
              },
            },
          ],

          source_documents: [],

          analytics: {
            yearly: [],
          },
        }
      );

    assert.match(
      answer,
      /615 000 USD/,
    );

    assert.match(
      answer,
      /Спільна сумісна власність/,
    );

    assert.match(
      answer,
      /Тестовий Декларант \(декларант\)/,
    );

    assert.match(
      answer,
      /Тестова Дружина \(дружина\)/,
    );
  },
);

test(
  "deduplicates copied cash facts while using full fact set",
  () => {
    const duplicate = {
      fact_type:
        "cash_asset",

      metadata: {
        declaration_year:
          2020,

        item_ref:
          "cash-shared-1",
      },

      value_json: {
        asset_type:
          "Готівкові кошти",

        amount:
          615000,

        currency:
          "USD",

        person:
          null,

        rights: [
          {
            actor: {
              ref:
                "1",

              role:
                "declarant",

              name:
                "Тестовий Декларант",
            },

            ownership_type:
              "Спільна сумісна власність",
          },

          {
            actor: {
              ref:
                "family-1",

              role:
                "family",

              name:
                "Тестова Дружина",

              relation:
                "дружина",
            },

            ownership_type:
              "Спільна сумісна власність",
          },
        ],
      },
    };

    const another = {
      fact_type:
        "cash_asset",

      metadata: {
        declaration_year:
          2020,

        item_ref:
          "cash-unique-2",
      },

      value_json: {
        asset_type:
          "Готівкові кошти",

        amount:
          100000,

        currency:
          "UAH",

        person: {
          ref:
            "1",

          role:
            "declarant",

          name:
            "Тестовий Декларант",
        },

        rights: [
          {
            actor: {
              ref:
                "1",

              role:
                "declarant",

              name:
                "Тестовий Декларант",
            },

            ownership_type:
              "Власність",
          },
        ],
      },
    };

    const answer =
      buildDeterministicCashAssetAnswer(
        "Які грошові активи декларанта і членів сім’ї були у 2020 році?",
        {
          detected_years:
            [2020],

          /*
           * Імітуємо урізаний retrieval:
           * тут є лише один факт.
           */
          facts: [
            duplicate,
          ],

          source_documents: [],

          analytics: {
            yearly: [],
          },
        },

        /*
         * Повний knowledge-набір:
         * duplicate є двічі з двох
         * source documents.
         */
        [
          {
            ...duplicate,

            source_document_id:
              "doc-a",
          },

          {
            ...duplicate,

            source_document_id:
              "doc-b",
          },

          another,
        ]
      );

    const usdMatches =
      answer.match(
        /615 000 USD/g
      ) ?? [];

    assert.equal(
      usdMatches.length,
      1,
    );

    assert.match(
      answer,
      /100 000 UAH/,
    );
  },
);

test(
  "keeps analytical cash question on AI path",
  () => {
    const answer =
      buildDeterministicCashAssetAnswer(
        "Проаналізуй динаміку грошових активів у 2024 та 2025 роках",
        {
          detected_years:
            [2024, 2025],

          facts: [
            {
              fact_type:
                "cash_asset",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                amount:
                  100000,

                currency:
                  "UAH",

                person: {
                  role:
                    "declarant",
                },
              },
            },
          ],
        }
      );

    assert.equal(
      answer,
      null,
    );
  },
);

test(
  "builds deterministic declarant vehicle list",
  () => {
    const answer =
      buildDeterministicVehicleAnswer(
        "Які автомобілі має декларант у 2025 році?",
        {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "vehicle",

              metadata: {
                declaration_year:
                  2025,
              },

              value_text:
                "LAND ROVER RANGE ROVER",

              value_json: {
                brand:
                  "LAND ROVER",

                model:
                  "RANGE ROVER",

                object_type:
                  "Автомобіль легковий",

                production_year:
                  2016,

                acquisition_date:
                  "19.05.2016",

                cost:
                  4693990,

                rights: [
                  {
                    actor: {
                      role:
                        "declarant",

                      name:
                        "Тестовий Декларант",

                      relation:
                        "декларант",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },

            {
              fact_type:
                "vehicle",

              metadata: {
                declaration_year:
                  2025,
              },

              value_text:
                "MERCEDES-BENZ S 500 4 MATIC",

              value_json: {
                brand:
                  "MERCEDES-BENZ",

                model:
                  "S 500 4 MATIC",

                rights: [
                  {
                    actor: {
                      role:
                        "family",

                      name:
                        "Тестова Дружина",

                      relation:
                        "дружина",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },
          ],

          source_documents: [],
          analytics: {
            yearly: [],
          },
        }
      );

    assert.match(
      answer,
      /LAND ROVER RANGE ROVER/,
    );

    assert.match(
      answer,
      /2016/,
    );

    assert.match(
      answer,
      /4 693 990 грн/,
    );

    assert.doesNotMatch(
      answer,
      /MERCEDES-BENZ/,
    );
  },
);

test(
  "builds deterministic family vehicle list",
  () => {
    const answer =
      buildDeterministicVehicleAnswer(
        "Які автомобілі членів сім’ї були у 2025 році?",
        {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "vehicle",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                brand:
                  "LAND ROVER",

                model:
                  "RANGE ROVER",

                rights: [
                  {
                    actor: {
                      role:
                        "declarant",

                      name:
                        "Декларант",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },

            {
              fact_type:
                "vehicle",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                brand:
                  "MERCEDES-BENZ",

                model:
                  "S 500 4 MATIC",

                production_year:
                  2014,

                acquisition_date:
                  "14.02.2014",

                cost:
                  1830637,

                rights: [
                  {
                    actor: {
                      role:
                        "family",

                      name:
                        "Тестова Дружина",

                      relation:
                        "дружина",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },
          ],

          source_documents: [],
          analytics: {
            yearly: [],
          },
        }
      );

    assert.match(
      answer,
      /MERCEDES-BENZ S 500 4 MATIC/,
    );

    assert.match(
      answer,
      /Тестова Дружина \(дружина\)/,
    );

    assert.match(
      answer,
      /1 830 637 грн/,
    );

    assert.doesNotMatch(
      answer,
      /LAND ROVER/,
    );
  },
);

test(
  "builds deterministic household vehicle list",
  () => {
    const answer =
      buildDeterministicVehicleAnswer(
        "Які автомобілі декларанта і членів сім’ї були у 2025 році?",
        {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "vehicle",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                brand:
                  "LAND ROVER",

                model:
                  "RANGE ROVER",

                rights: [
                  {
                    actor: {
                      role:
                        "declarant",

                      name:
                        "Декларант",

                      relation:
                        "декларант",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },

            {
              fact_type:
                "vehicle",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                brand:
                  "MERCEDES-BENZ",

                model:
                  "S 500 4 MATIC",

                rights: [
                  {
                    actor: {
                      role:
                        "family",

                      name:
                        "Дружина",

                      relation:
                        "дружина",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },
          ],

          source_documents: [],
          analytics: {
            yearly: [],
          },
        }
      );

    assert.match(
      answer,
      /LAND ROVER RANGE ROVER/,
    );

    assert.match(
      answer,
      /MERCEDES-BENZ S 500 4 MATIC/,
    );
  },
);

test(
  "keeps analytical vehicle question on AI path",
  () => {
    const answer =
      buildDeterministicVehicleAnswer(
        "Проаналізуй зміни автомобілів декларанта у 2024 та 2025 роках.",
        {
          detected_years:
            [2024, 2025],

          facts: [],
        }
      );

    assert.equal(
      answer,
      null,
    );
  },
);

test(
  "builds deterministic organization relation list",
  () => {
    const answer =
      buildDeterministicOrganizationRelationsAnswer(
        "Які зв'язки з організаціями має декларант у 2025 році? Назви організації та тип зв'язку.",
        {
          detected_years:
            [2025],

          relations: [
            {
              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              from_entity_type:
                "asset",

              from_name:
                "Квартира · 269.7 м²",

              to_entity_type:
                "organization_observation",

              to_name:
                "Алдоранте Лімітед",
            },

            {
              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              from_entity_type:
                "asset",

              from_name:
                "Машиномісце · 21.9 м²",

              to_entity_type:
                "organization_observation",

              to_name:
                "Алдоранте Лімітед",
            },

            {
              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              from_entity_type:
                "asset",

              from_name:
                "Квартира · 91.9 м²",

              to_entity_type:
                "organization_observation",

              to_name:
                "Стренд Резідентіал",
            },

            {
              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              from_entity_type:
                "asset",

              from_name:
                "Інше · 4011.1 м²",

              to_entity_type:
                "organization",

              to_name:
                'Державне управління справами "Будинок відпочинку "КОНЧА-ЗАСПА""',
            },

            {
              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              from_entity_type:
                "asset",

              from_name:
                "Квартира · 254.5 м²",

              to_entity_type:
                "person_observation",

              to_name:
                "Тестова Людина",
            },
          ],

          source_documents: [],
          analytics: {
            yearly: [],
          },
        }
      );

    assert.match(
      answer,
      /Алдоранте Лімітед/,
    );

    assert.match(
      answer,
      /Квартира · 269\.7 м²/,
    );

    assert.match(
      answer,
      /Машиномісце · 21\.9 м²/,
    );

    assert.match(
      answer,
      /Стренд Резідентіал/,
    );

    assert.match(
      answer,
      /КОНЧА-ЗАСПА/,
    );

    assert.match(
      answer,
      /непрям/i,
    );

    assert.doesNotMatch(
      answer,
      /Тестова Людина/,
    );

    assert.doesNotMatch(
      answer,
      /source_document_id|verification_status|confidence/,
    );
  },
);

test(
  "recognizes instrumental organization relation wording",
  () => {
    const answer =
      buildDeterministicOrganizationRelationsAnswer(
        "З якими організаціями був пов’язаний декларант у 2025 році?",
        {
          detected_years:
            [2025],

          relations: [
            {
              relation_type:
                "third_party_rightsholder",

              relation_scope:
                "second_hop",

              from_entity_type:
                "asset",

              from_name:
                "Квартира · 100 м²",

              to_entity_type:
                "organization",

              to_name:
                "Тестова Організація",
            },
          ],

          source_documents: [],

          analytics: {
            yearly: [],
          },
        }
      );

    assert.ok(
      answer
    );

    assert.match(
      answer,
      /Тестова Організація/,
    );

    assert.match(
      answer,
      /Зв’язки декларанта з організаціями за 2025 рік/,
    );
  },
);

test(
  "keeps analytical relation question on AI path",
  () => {
    const answer =
      buildDeterministicOrganizationRelationsAnswer(
        "Проаналізуй зв'язки декларанта з організаціями у 2025 році та поясни, що вони можуть означати.",
        {
          detected_years:
            [2025],

          relations: [
            {
              relation_type:
                "third_party_rightsholder",

              to_entity_type:
                "organization",

              to_name:
                "Тестова Організація",
            },
          ],
        }
      );

    assert.equal(
      answer,
      null,
    );
  },
);

test(
  "builds grounded deterministic declarant real estate list",
  () => {
    const answer =
      buildDeterministicRealEstateAnswer(
        "Яку нерухомість декларант мав у 2025 році?",
        {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "real_estate",

              value_text:
                "Квартира",

              value_number:
                91.9,

              unit:
                "m2",

              source_document_id:
                "doc-2025",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                object_type:
                  "Квартира",

                total_area:
                  91.9,

                country:
                  "40",

                region:
                  null,

                city:
                  null,

                acquisition_date:
                  "20.11.2014",

                rights: [
                  {
                    actor: {
                      role:
                        "declarant",
                    },

                    ownership_type:
                      "Інше право користування",

                    other_ownership:
                      "Право користування на підставі юридичного права Лісхолд",
                  },
                ],
              },
            },

            {
              fact_type:
                "real_estate",

              value_text:
                "Інше",

              value_number:
                4011.1,

              unit:
                "m2",

              source_document_id:
                "doc-2025",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                object_type:
                  "Інше",

                other_object_type:
                  "Державна дача",

                total_area:
                  4011.1,

                region:
                  "Київ",

                acquisition_date:
                  "01.07.2020",

                rights: [
                  {
                    actor: {
                      role:
                        "declarant",
                    },

                    ownership_type:
                      "Інше право користування",

                    other_ownership:
                      "проживання та користування",
                  },
                ],
              },
            },

            {
              fact_type:
                "real_estate",

              value_text:
                "Будинок",

              value_number:
                200,

              unit:
                "m2",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                object_type:
                  "Будинок",

                total_area:
                  200,

                region:
                  "Київ",

                rights: [
                  {
                    actor: {
                      role:
                        "family",

                      name:
                        "Член сім’ї",
                    },

                    ownership_type:
                      "Власність",
                  },
                ],
              },
            },
          ],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-2025",
              },
            ],
          },

          source_documents: [
            {
              id:
                "doc-2025",

              url:
                "https://example.test/declaration-2025",
            },
          ],
        }
      );

    assert.match(
      answer,
      /91,9 м²/,
    );

    assert.match(
      answer,
      /Місцезнаходження: не зазначено/,
    );

    assert.match(
      answer,
      /Лісхолд/,
    );

    assert.match(
      answer,
      /01\.07\.2020/,
    );

    assert.match(
      answer,
      /4[\s\u00a0\u202f]011,1 м²/,
    );

    assert.doesNotMatch(
      answer,
      /Член сім’ї/,
    );

    assert.doesNotMatch(
      answer,
      /country|Україна/,
    );
  },
);

test(
  "builds stateless Responses API request",
  () => {
    const request =
      buildResponsesRequest({
        question:
          "Який був дохід?",
        model:
          "test-model",

        context: {
          subject: {
            full_name:
              "Тестова Особа",
          },

          source_documents: [
            {
              id: "doc-1",

              raw_payload: {
                public_field:
                  "PUBLIC_OPEN_DATA",
              },
            },
          ],
        },
      });

    assert.equal(
      request.model,
      "test-model",
    );

    assert.equal(
      request.store,
      false,
    );

    assert.equal(
      Array.isArray(
        request.input,
      ),
      true,
    );

    const serialized =
      JSON.stringify(request);

    assert.match(
      serialized,
      /Тестова Особа/,
    );

    assert.doesNotMatch(
      serialized,
      /PUBLIC_OPEN_DATA/,
    );

    assert.match(
      serialized,
      /raw_payload_available/,
    );

    assert.match(
      serialized,
      /raw_payload_chars/,
    );
  },
);


test(
  "uses analytics only for multi-year aggregate income question",
  () => {
    const request =
      buildResponsesRequest({
        question:
          "Порівняй доходи за 2024 та 2025 роки та скажи відсоток зміни.",

        model:
          "test-model",

        context: {
          detected_years:
            [2024, 2025],

          facts: [
            {
              fact_type:
                "income",

              value_text:
                "PARTIAL_FACT_MUST_NOT_BE_USED",
            },
          ],

          analytics: {
            yearly: [
              {
                year: 2024,

                incomeDeclarantUah:
                  6907216,
              },
              {
                year: 2025,

                incomeDeclarantUah:
                  7118608,
              },
            ],

            transitions: [
              {
                fromYear: 2024,
                toYear: 2025,

                incomeDelta:
                  211392,

                incomeDeltaPercent:
                  3.06,
              },
            ],
          },

          relations: [],
          mentions: [],
          cross_checks: [],
          source_documents: [],
        },
      });

    const serialized =
      JSON.stringify(request);

    assert.match(
      serialized,
      /6907216/,
    );

    assert.match(
      serialized,
      /7118608/,
    );

    assert.match(
      serialized,
      /211392/,
    );

    assert.match(
      serialized,
      /3\.06/,
    );

    const promptContent =
      String(
        request.input
          .at(-1)
          ?.content ??
        "",
      );

    assert.doesNotMatch(
      serialized,
      /PARTIAL_FACT_MUST_NOT_BE_USED/,
    );

    assert.doesNotMatch(
      promptContent,
      /model_context_policy/,
    );

    assert.doesNotMatch(
      promptContent,
      /analytics_only/,
    );

    assert.doesNotMatch(
      promptContent,
      /incomeDeclarantUah/,
    );

    assert.doesNotMatch(
      promptContent,
      /incomeDelta/,
    );

    assert.match(
      promptContent,
      /declarant_income_uah/,
    );

    assert.match(
      promptContent,
      /income_change_percent/,
    );
  },
);


test(
  "uses calculated summary for single-year total income question",
  () => {
    const request =
      buildResponsesRequest({
        question:
          "Який дохід у 2025 році?",

        model:
          "test-model",

        context: {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "income",

              value_text:
                "PARTIAL_SINGLE_YEAR_FACT",
            },
          ],

          analytics: {
            yearly: [
              {
                year: 2025,

                incomeDeclarantUah:
                  7118608,
              },
            ],

            transitions: [],
          },

          relations: [],
          mentions: [],
          cross_checks: [],
          source_documents: [],
        },
      });

    const serialized =
      JSON.stringify(request);

    assert.match(
      serialized,
      /7118608/,
    );

    assert.doesNotMatch(
      serialized,
      /PARTIAL_SINGLE_YEAR_FACT/,
    );

    assert.equal(
      request.tools,
      undefined,
    );

    assert.equal(
      request.tool_choice,
      undefined,
    );

    assert.doesNotMatch(
      serialized,
      /model_context_counts/,
    );
  },
);

test(
  "keeps income facts for source-detail question",
  () => {
    const request =
      buildResponsesRequest({
        question:
          "Які джерела доходу були у 2025 році?",

        model:
          "test-model",

        context: {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "income",

              value_text:
                "DETAIL_INCOME_FACT",
            },
          ],

          analytics: {
            yearly: [
              {
                year: 2025,

                incomeDeclarantUah:
                  7118608,
              },
            ],

            transitions: [],
          },

          relations: [],
          mentions: [],
          cross_checks: [],
          source_documents: [],
        },
      });

    const serialized =
      JSON.stringify(request);

    assert.match(
      serialized,
      /DETAIL_INCOME_FACT/,
    );

    assert.equal(
      request.tools,
      undefined,
    );

    assert.equal(
      request.tool_choice,
      undefined,
    );

    assert.doesNotMatch(
      serialized,
      /calculated_summary/,
    );
  },
);

test(
  "compacts model-visible source document metadata",
  () => {
    const request =
      buildResponsesRequest({
        question:
          "Які джерела доходу були у 2025 році?",

        model:
          "test-model",

        context: {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "income",

              value_text:
                "заробітна плата",
            },
          ],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                incomeDeclarantUah:
                  7118608,
              },
            ],

            transitions: [],
          },

          relations: [],
          mentions: [],
          cross_checks: [],

          source_documents: [
            {
              id:
                "doc-1",

              source_type:
                "nazk-declaration",

              source_name:
                "НАЗК",

              url:
                "https://example.test/doc-1",

              title:
                "Декларація",

              metadata: {
                VERY_LARGE_METADATA:
                  "MUST_NOT_REACH_MODEL",
              },

              raw_payload: {
                PUBLIC_RAW_DATA:
                  "MUST_NOT_REACH_MODEL_DIRECTLY",
              },
            },
          ],
        },
      });

    const serialized =
      JSON.stringify(request);

    assert.doesNotMatch(
      serialized,
      /VERY_LARGE_METADATA/,
    );

    assert.doesNotMatch(
      serialized,
      /PUBLIC_RAW_DATA/,
    );

    assert.match(
      serialized,
      /raw_payload_available/,
    );

    assert.match(
      serialized,
      /https:\/\/example\.test\/doc-1/,
    );
  },
);

test(
  "builds deterministic family income source list",
  () => {
    const answer =
      buildDeterministicIncomeDetailAnswer(
        "Які джерела доходу сім'ї були у 2025 році?",
        {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "income",

              value_text:
                "Заробітна плата",

              value_number:
                336000,

              unit:
                "UAH",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                amount:
                  336000,

                income_type:
                  "Заробітна плата",

                source:
                  "DECLARANT SOURCE",

                person: {
                  role:
                    "declarant",
                },
              },
            },

            {
              fact_type:
                "income",

              value_text:
                "Проценти",

              value_number:
                89062,

              unit:
                "UAH",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                amount:
                  89062,

                income_type:
                  "Проценти",

                source:
                  "FAMILY BANK",

                person: {
                  role:
                    "family",

                  name:
                    "Тестова Особа",

                  relationship:
                    "дружина",
                },
              },
            },
          ],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-2025",

                incomeDeclarantUah:
                  336000,

                incomeHouseholdUah:
                  425062,
              },
            ],
          },

          source_documents: [
            {
              id:
                "doc-2025",

              url:
                "https://example.test/declaration-2025",
            },
          ],
        }
      );

    assert.match(
      answer,
      /Тестова Особа/,
    );

    assert.match(
      answer,
      /дружина/,
    );

    assert.match(
      answer,
      /89 062 UAH/,
    );

    assert.match(
      answer,
      /FAMILY BANK/,
    );

    assert.match(
      answer,
      /Загальна сума доходу членів сім’ї/,
    );

    assert.doesNotMatch(
      answer,
      /DECLARANT SOURCE/,
    );
  },
);

test(
  "distinguishes family income from household income",
  () => {
    const family =
      buildDeterministicAnalyticsAnswer(
        "Який дохід сім'ї у 2025 році?",
        {
          detected_years:
            [2025],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                incomeDeclarantUah:
                  7118608,

                incomeHouseholdUah:
                  15805828,
              },
            ],

            transitions: [],
          },

          source_documents: [],
        }
      );

    const household =
      buildDeterministicAnalyticsAnswer(
        "Який дохід домогосподарства у 2025 році?",
        {
          detected_years:
            [2025],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                incomeDeclarantUah:
                  7118608,

                incomeHouseholdUah:
                  15805828,
              },
            ],

            transitions: [],
          },

          source_documents: [],
        }
      );

    assert.match(
      family,
      /8 687 220 грн/,
    );

    assert.match(
      family,
      /дохід членів сім’ї/,
    );

    assert.match(
      household,
      /15 805 828 грн/,
    );

    assert.match(
      household,
      /дохід домогосподарства/,
    );
  },
);

test(
  "builds deterministic declarant income source list",
  () => {
    const answer =
      buildDeterministicIncomeDetailAnswer(
        "Які джерела доходу були у 2025 році?",
        {
          detected_years:
            [2025],

          facts: [
            {
              fact_type:
                "income",

              value_text:
                "Заробітна плата",

              value_number:
                336000,

              unit:
                "UAH",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                amount:
                  336000,

                income_type:
                  "Заробітна плата",

                source:
                  "ДЕРЖАВНЕ УПРАВЛІННЯ СПРАВАМИ",

                person: {
                  role:
                    "declarant",
                },
              },
            },

            {
              fact_type:
                "income",

              value_text:
                "Проценти",

              value_number:
                89062,

              unit:
                "UAH",

              metadata: {
                declaration_year:
                  2025,
              },

              value_json: {
                amount:
                  89062,

                income_type:
                  "Проценти",

                source:
                  "FAMILY BANK",

                person: {
                  role:
                    "family_member",
                },
              },
            },
          ],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-2025",

                incomeDeclarantUah:
                  336000,
              },
            ],
          },

          source_documents: [
            {
              id:
                "doc-2025",

              url:
                "https://example.test/declaration-2025",
            },
          ],
        }
      );

    assert.match(
      answer,
      /336 000 UAH/,
    );

    assert.match(
      answer,
      /ДЕРЖАВНЕ УПРАВЛІННЯ СПРАВАМИ/,
    );

    assert.doesNotMatch(
      answer,
      /FAMILY BANK/,
    );

    assert.match(
      answer,
      /Загальна сума доходу декларанта/,
    );

    assert.match(
      answer,
      /declaration-2025/,
    );
  },
);

test(
  "builds deterministic income answer without model speculation",
  () => {
    const answer =
      buildDeterministicAnalyticsAnswer(
        "Який дохід у 2025 році?",
        {
          detected_years:
            [2025],

          analytics: {
            yearly: [
              {
                year:
                  2025,

                sourceDocumentId:
                  "doc-2025",

                incomeDeclarantUah:
                  7118608,
              },
            ],

            transitions: [],
          },

          source_documents: [
            {
              id:
                "doc-2025",

              url:
                "https://example.test/declaration-2025",
            },
          ],
        }
      );

    assert.match(
      answer,
      /7 118 608 грн/,
    );

    assert.match(
      answer,
      /declaration-2025/,
    );

    assert.doesNotMatch(
      answer,
      /витрат|підтримк|звичайному розумінні/i,
    );
  },
);

test(
  "uses subject profile preflight without loading full subject knowledge",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          throw new Error(
            "MODEL_SHOULD_NOT_BE_CALLED"
          );
        },
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Покажи основну інформацію про суб’єкта",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async (subjectId) => {
            subjectCalls += 1;

            assert.equal(
              subjectId,
              "subject-1",
            );

            return {
              id:
                "subject-1",

              entity_id:
                "entity-1",

              full_name:
                "Тестова Особа",

              organization:
                "Тестова Організація",

              position:
                "Тестова Посада",

              city:
                "Київ",
            };
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            throw new Error(
              "FULL_KNOWLEDGE_SHOULD_NOT_LOAD"
            );
          },

        retriever:
          () => {
            retrieverCalls += 1;

            throw new Error(
              "RETRIEVER_SHOULD_NOT_RUN"
            );
          },
      });

    assert.equal(
      result.model,
      "person-monitor-facts",
    );

    assert.equal(
      result.retrieval.version,
      "deterministic-subject-profile-v1",
    );

    assert.deepEqual(
      result.retrieval
        .detected_years,
      [],
    );

    assert.equal(
      result.retrieval
        .counts.facts,
      0,
    );

    assert.match(
      result.answer,
      /Тестова Особа/,
    );

    assert.match(
      result.answer,
      /Тестова Організація/,
    );

    assert.match(
      result.answer,
      /Тестова Посада/,
    );

    assert.match(
      result.answer,
      /Київ/,
    );

    assert.equal(
      subjectCalls,
      1,
    );

    assert.equal(
      knowledgeCalls,
      0,
    );

    assert.equal(
      retrieverCalls,
      0,
    );

    assert.equal(
      modelCalls,
      0,
    );
  },
);

test(
  "does not use current subject profile preflight for year-specific question",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          return {
            output_text:
              "Історична відповідь",
          };
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",

        organization:
          "Поточна Організація",

        position:
          "Поточна Посада",

        city:
          "Київ",
      },
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 0,
        relations: 0,
        mentions: 0,
        cross_checks: 0,
        source_documents: 0,
      },

      subject:
        fakeKnowledge.subject,

      facts: [],
      relations: [],
      mentions: [],
      cross_checks: [],
      source_documents: [],

      analytics: {
        yearly: [],
        transitions: [],
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Покажи основну інформацію про суб’єкта за 2025 рік",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async () => {
            subjectCalls += 1;

            throw new Error(
              "CURRENT_PROFILE_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            return fakeKnowledge;
          },

        retriever:
          () => {
            retrieverCalls += 1;

            return fakeContext;
          },
      });

    assert.equal(
      result.answer,
      "Історична відповідь",
    );

    assert.equal(
      result.model,
      "test-model",
    );

    assert.equal(
      result.retrieval.version,
      "subject-retrieval-v1",
    );

    assert.equal(
      subjectCalls,
      0,
    );

    assert.equal(
      knowledgeCalls,
      1,
    );

    assert.equal(
      retrieverCalls,
      1,
    );

    assert.equal(
      modelCalls,
      1,
    );
  },
);

test(
  "uses cash asset preflight without loading full subject knowledge",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let cashCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          throw new Error(
            "MODEL_SHOULD_NOT_BE_CALLED"
          );
        },
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Які грошові активи мали декларант та члени сім’ї у 2020 році?",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async (subjectId) => {
            subjectCalls += 1;

            assert.equal(
              subjectId,
              "subject-1",
            );

            return {
              id:
                "subject-1",

              entity_id:
                "entity-1",
            };
          },

        cashContextLoader:
          async (
            entityId,
            year
          ) => {
            cashCalls += 1;

            assert.equal(
              entityId,
              "entity-1",
            );

            assert.equal(
              year,
              2020,
            );

            return {
              detected_years:
                [2020],

              facts: [
                {
                  fact_type:
                    "cash_asset",

                  source_document_id:
                    "doc-2020",

                  value_text:
                    "Готівкові кошти",

                  value_number:
                    1000,

                  unit:
                    "USD",

                  metadata: {
                    declaration_year:
                      2020,

                    item_ref:
                      "cash-1",
                  },

                  value_json: {
                    asset_type:
                      "Готівкові кошти",

                    amount:
                      1000,

                    currency:
                      "USD",

                    rights: [
                      {
                        actor: {
                          role:
                            "declarant",

                          ref:
                            "person-declarant",

                          name:
                            "Тестовий Декларант",

                          relation:
                            "декларант",
                        },

                        ownership_type:
                          "Власність",
                      },

                      {
                        actor: {
                          role:
                            "family",

                          ref:
                            "person-family",

                          name:
                            "Тестова Дружина",

                          relation:
                            "дружина",
                        },

                        ownership_type:
                          "Власність",
                      },
                    ],
                  },
                },
              ],

              analytics: {
                yearly: [
                  {
                    year:
                      2020,

                    sourceDocumentId:
                      "doc-2020",
                  },
                ],
              },

              source_documents: [
                {
                  id:
                    "doc-2020",

                  url:
                    "https://example.test/declaration-2020",
                },
              ],
            };
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            throw new Error(
              "FULL_KNOWLEDGE_SHOULD_NOT_LOAD"
            );
          },

        retriever:
          () => {
            retrieverCalls += 1;

            throw new Error(
              "RETRIEVER_SHOULD_NOT_RUN"
            );
          },
      });

    assert.equal(
      result.model,
      "person-monitor-facts",
    );

    assert.equal(
      result.retrieval.version,
      "deterministic-cash-assets-v1",
    );

    assert.deepEqual(
      result.retrieval
        .detected_years,
      [2020],
    );

    assert.equal(
      result.retrieval
        .counts.facts,
      1,
    );

    assert.equal(
      result.retrieval
        .counts.source_documents,
      1,
    );

    assert.match(
      result.answer,
      /Грошові активи домогосподарства за 2020 рік/,
    );

    assert.match(
      result.answer,
      /1 000 USD/,
    );

    assert.match(
      result.answer,
      /Тестовий Декларант \(декларант\)/,
    );

    assert.match(
      result.answer,
      /Тестова Дружина \(дружина\)/,
    );

    assert.match(
      result.answer,
      /declaration-2020/,
    );

    assert.equal(
      subjectCalls,
      1,
    );

    assert.equal(
      cashCalls,
      1,
    );

    assert.equal(
      knowledgeCalls,
      0,
    );

    assert.equal(
      retrieverCalls,
      0,
    );

    assert.equal(
      modelCalls,
      0,
    );
  },
);

test(
  "falls back to full knowledge pipeline for analytical cash asset question",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let cashCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          return {
            output_text:
              "Аналітична відповідь",
          };
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },

      facts: [],
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 1,
        relations: 0,
        mentions: 0,
        cross_checks: 0,
        source_documents: 0,
      },

      subject:
        fakeKnowledge.subject,

      facts: [
        {
          fact_type:
            "cash_asset",

          metadata: {
            declaration_year:
              2025,
          },

          value_number:
            1000,

          unit:
            "USD",

          value_json: {
            amount:
              1000,

            currency:
              "USD",

            rights: [
              {
                actor: {
                  role:
                    "declarant",
                },

                ownership_type:
                  "Власність",
              },
            ],
          },
        },
      ],

      relations: [],
      mentions: [],
      cross_checks: [],
      source_documents: [],

      analytics: {
        yearly: [],
        transitions: [],
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Проаналізуй грошові активи декларанта у 2025 році та оціни ризики",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async () => {
            subjectCalls += 1;

            throw new Error(
              "SUBJECT_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        cashContextLoader:
          async () => {
            cashCalls += 1;

            throw new Error(
              "CASH_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            return fakeKnowledge;
          },

        retriever:
          () => {
            retrieverCalls += 1;

            return fakeContext;
          },
      });

    assert.equal(
      result.answer,
      "Аналітична відповідь",
    );

    assert.equal(
      result.model,
      "test-model",
    );

    assert.equal(
      result.retrieval.version,
      "subject-retrieval-v1",
    );

    assert.equal(
      subjectCalls,
      0,
    );

    assert.equal(
      cashCalls,
      0,
    );

    assert.equal(
      knowledgeCalls,
      1,
    );

    assert.equal(
      retrieverCalls,
      1,
    );

    assert.equal(
      modelCalls,
      1,
    );
  },
);

test(
  "uses vehicle preflight without loading full subject knowledge",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let vehicleCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          throw new Error(
            "MODEL_SHOULD_NOT_BE_CALLED"
          );
        },
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Які автомобілі були у декларанта та членів сім’ї у 2025 році?",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async (subjectId) => {
            subjectCalls += 1;

            assert.equal(
              subjectId,
              "subject-1",
            );

            return {
              id:
                "subject-1",

              entity_id:
                "entity-1",

              full_name:
                "Тестова Особа",
            };
          },

        vehicleContextLoader:
          async (
            entityId,
            year
          ) => {
            vehicleCalls += 1;

            assert.equal(
              entityId,
              "entity-1",
            );

            assert.equal(
              year,
              2025,
            );

            return {
              detected_years:
                [2025],

              facts: [
                {
                  fact_type:
                    "vehicle",

                  source_document_id:
                    "doc-2025",

                  metadata: {
                    declaration_year:
                      2025,
                  },

                  value_json: {
                    brand:
                      "LAND ROVER",

                    model:
                      "RANGE ROVER",

                    production_year:
                      2016,

                    acquisition_date:
                      "2016-05-19",

                    cost:
                      4693990,

                    rights: [
                      {
                        actor: {
                          role:
                            "declarant",

                          name:
                            "Тестовий Декларант",
                        },

                        ownership_type:
                          "Власність",
                      },
                    ],
                  },
                },

                {
                  fact_type:
                    "vehicle",

                  source_document_id:
                    "doc-2025",

                  metadata: {
                    declaration_year:
                      2025,
                  },

                  value_json: {
                    brand:
                      "MERCEDES-BENZ",

                    model:
                      "S 500 4 MATIC",

                    production_year:
                      2014,

                    acquisition_date:
                      "2014-02-14",

                    cost:
                      1830637,

                    rights: [
                      {
                        actor: {
                          role:
                            "family",

                          name:
                            "Тестова Дружина",

                          relation:
                            "дружина",
                        },

                        ownership_type:
                          "Власність",
                      },
                    ],
                  },
                },
              ],

              analytics: {
                yearly: [
                  {
                    year:
                      2025,

                    sourceDocumentId:
                      "doc-2025",
                  },
                ],
              },

              source_documents: [
                {
                  id:
                    "doc-2025",

                  url:
                    "https://example.test/declaration-2025",
                },
              ],
            };
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            throw new Error(
              "FULL_KNOWLEDGE_SHOULD_NOT_LOAD"
            );
          },

        retriever:
          () => {
            retrieverCalls += 1;

            throw new Error(
              "RETRIEVER_SHOULD_NOT_RUN"
            );
          },
      });

    assert.equal(
      result.model,
      "person-monitor-facts",
    );

    assert.equal(
      result.retrieval.version,
      "deterministic-vehicles-v1",
    );

    assert.deepEqual(
      result.retrieval
        .detected_years,
      [2025],
    );

    assert.equal(
      result.retrieval
        .counts.facts,
      2,
    );

    assert.equal(
      result.retrieval
        .counts.source_documents,
      1,
    );

    assert.match(
      result.answer,
      /LAND ROVER RANGE ROVER/,
    );

    assert.match(
      result.answer,
      /MERCEDES-BENZ S 500 4 MATIC/,
    );

    assert.match(
      result.answer,
      /4 693 990/,
    );

    assert.match(
      result.answer,
      /1 830 637/,
    );

    assert.match(
      result.answer,
      /Тестова Дружина \(дружина\)/,
    );

    assert.match(
      result.answer,
      /declaration-2025/,
    );

    assert.equal(
      subjectCalls,
      1,
    );

    assert.equal(
      vehicleCalls,
      1,
    );

    assert.equal(
      knowledgeCalls,
      0,
    );

    assert.equal(
      retrieverCalls,
      0,
    );

    assert.equal(
      modelCalls,
      0,
    );
  },
);

test(
  "falls back to full knowledge pipeline for analytical vehicle question",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let vehicleCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          return {
            output_text:
              "Аналітична відповідь",
          };
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },

      facts: [],
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 1,
        relations: 0,
        mentions: 0,
        cross_checks: 0,
        source_documents: 0,
      },

      subject:
        fakeKnowledge.subject,

      facts: [
        {
          fact_type:
            "vehicle",

          source_document_id:
            "doc-2025",

          metadata: {
            declaration_year:
              2025,
          },

          value_json: {
            brand:
              "LAND ROVER",

            model:
              "RANGE ROVER",

            production_year:
              2016,

            rights: [
              {
                actor: {
                  role:
                    "declarant",
                },

                ownership_type:
                  "Власність",
              },
            ],
          },
        },
      ],

      relations: [],
      mentions: [],
      cross_checks: [],
      source_documents: [],

      analytics: {
        yearly: [],
        transitions: [],
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Проаналізуй автомобілі декларанта у 2025 році та оціни ризики",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async () => {
            subjectCalls += 1;

            throw new Error(
              "SUBJECT_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        vehicleContextLoader:
          async () => {
            vehicleCalls += 1;

            throw new Error(
              "VEHICLE_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            return fakeKnowledge;
          },

        retriever:
          () => {
            retrieverCalls += 1;

            return fakeContext;
          },
      });

    assert.equal(
      result.answer,
      "Аналітична відповідь",
    );

    assert.equal(
      result.model,
      "test-model",
    );

    assert.equal(
      result.retrieval.version,
      "subject-retrieval-v1",
    );

    assert.equal(
      subjectCalls,
      0,
    );

    assert.equal(
      vehicleCalls,
      0,
    );

    assert.equal(
      knowledgeCalls,
      1,
    );

    assert.equal(
      retrieverCalls,
      1,
    );

    assert.equal(
      modelCalls,
      1,
    );
  },
);

test(
  "uses family member preflight without loading full subject knowledge",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let familyCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          throw new Error(
            "MODEL_SHOULD_NOT_BE_CALLED"
          );
        },
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Які члени сім’ї були у декларанта у 2025 році?",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async (subjectId) => {
            subjectCalls += 1;

            assert.equal(
              subjectId,
              "subject-1",
            );

            return {
              id:
                "subject-1",

              entity_id:
                "entity-1",

              full_name:
                "Тестова Особа",
            };
          },

        familyContextLoader:
          async (
            entityId,
            year
          ) => {
            familyCalls += 1;

            assert.equal(
              entityId,
              "entity-1",
            );

            assert.equal(
              year,
              2025,
            );

            return {
              detected_years:
                [2025],

              facts: [
                {
                  fact_type:
                    "family_member",

                  source_document_id:
                    "doc-2025",

                  metadata: {
                    declaration_year:
                      2025,
                  },

                  value_text:
                    "Тестова Дружина",

                  value_json: {
                    name:
                      "Тестова Дружина",

                    relation:
                      "дружина",

                    person_ref:
                      "family-wife",
                  },
                },

                {
                  fact_type:
                    "family_member",

                  source_document_id:
                    "doc-2025",

                  metadata: {
                    declaration_year:
                      2025,
                  },

                  value_text:
                    "Тестовий Син",

                  value_json: {
                    name:
                      "Тестовий Син",

                    relation:
                      "син",

                    person_ref:
                      "family-son",
                  },
                },
              ],

              analytics: {
                yearly: [
                  {
                    year:
                      2025,

                    sourceDocumentId:
                      "doc-2025",
                  },
                ],
              },

              source_documents: [
                {
                  id:
                    "doc-2025",

                  url:
                    "https://example.test/declaration-2025",
                },
              ],
            };
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            throw new Error(
              "FULL_KNOWLEDGE_SHOULD_NOT_LOAD"
            );
          },

        retriever:
          () => {
            retrieverCalls += 1;

            throw new Error(
              "RETRIEVER_SHOULD_NOT_RUN"
            );
          },
      });

    assert.equal(
      result.model,
      "person-monitor-facts",
    );

    assert.equal(
      result.retrieval.version,
      "deterministic-family-members-v1",
    );

    assert.deepEqual(
      result.retrieval
        .detected_years,
      [2025],
    );

    assert.equal(
      result.retrieval
        .counts.facts,
      2,
    );

    assert.equal(
      result.retrieval
        .counts.source_documents,
      1,
    );

    assert.match(
      result.answer,
      /Тестова Дружина/,
    );

    assert.match(
      result.answer,
      /дружина/,
    );

    assert.match(
      result.answer,
      /Тестовий Син/,
    );

    assert.match(
      result.answer,
      /син/,
    );

    assert.match(
      result.answer,
      /declaration-2025/,
    );

    assert.equal(
      subjectCalls,
      1,
    );

    assert.equal(
      familyCalls,
      1,
    );

    assert.equal(
      knowledgeCalls,
      0,
    );

    assert.equal(
      retrieverCalls,
      0,
    );

    assert.equal(
      modelCalls,
      0,
    );
  },
);

test(
  "falls back to full knowledge pipeline for analytical family member question",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let familyCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          return {
            output_text:
              "Аналітична відповідь",
          };
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },

      facts: [],
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 1,
        relations: 0,
        mentions: 0,
        cross_checks: 0,
        source_documents: 0,
      },

      subject:
        fakeKnowledge.subject,

      facts: [
        {
          fact_type:
            "family_member",

          source_document_id:
            "doc-2025",

          metadata: {
            declaration_year:
              2025,
          },

          value_text:
            "Тестова Дружина",

          value_json: {
            name:
              "Тестова Дружина",

            relation:
              "дружина",

            person_ref:
              "family-wife",
          },
        },
      ],

      relations: [],
      mentions: [],
      cross_checks: [],
      source_documents: [],

      analytics: {
        yearly: [],
        transitions: [],
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Проаналізуй, які члени сім’ї були у 2025 році та оціни зміни",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async () => {
            subjectCalls += 1;

            throw new Error(
              "SUBJECT_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        familyContextLoader:
          async () => {
            familyCalls += 1;

            throw new Error(
              "FAMILY_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            return fakeKnowledge;
          },

        retriever:
          () => {
            retrieverCalls += 1;

            return fakeContext;
          },
      });

    assert.equal(
      result.answer,
      "Аналітична відповідь",
    );

    assert.equal(
      result.model,
      "test-model",
    );

    assert.equal(
      result.retrieval.version,
      "subject-retrieval-v1",
    );

    assert.equal(
      subjectCalls,
      0,
    );

    assert.equal(
      familyCalls,
      0,
    );

    assert.equal(
      knowledgeCalls,
      1,
    );

    assert.equal(
      retrieverCalls,
      1,
    );

    assert.equal(
      modelCalls,
      1,
    );
  },
);

test(
  "uses income detail preflight without loading full subject knowledge",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let incomeCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          throw new Error(
            "MODEL_SHOULD_NOT_BE_CALLED"
          );
        },
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Які джерела доходу декларанта були у 2025 році?",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async (subjectId) => {
            subjectCalls += 1;

            assert.equal(
              subjectId,
              "subject-1",
            );

            return {
              id:
                "subject-1",

              entity_id:
                "entity-1",

              full_name:
                "Тестова Особа",
            };
          },

        incomeContextLoader:
          async (
            entityId,
            year
          ) => {
            incomeCalls += 1;

            assert.equal(
              entityId,
              "entity-1",
            );

            assert.equal(
              year,
              2025,
            );

            return {
              detected_years:
                [2025],

              facts: [
                {
                  fact_type:
                    "income",

                  value_text:
                    "Заробітна плата",

                  value_number:
                    100000,

                  unit:
                    "UAH",

                  source_document_id:
                    "doc-2025",

                  metadata: {
                    declaration_year:
                      2025,
                  },

                  value_json: {
                    person: {
                      role:
                        "declarant",
                    },

                    income_type:
                      "Заробітна плата",

                    source:
                      "Тестова Установа",

                    amount:
                      100000,
                  },
                },
              ],

              analytics: {
                yearly: [
                  {
                    year:
                      2025,

                    sourceDocumentId:
                      "doc-2025",
                  },
                ],
              },

              source_documents: [
                {
                  id:
                    "doc-2025",

                  url:
                    "https://example.test/declaration-2025",
                },
              ],
            };
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            throw new Error(
              "FULL_KNOWLEDGE_SHOULD_NOT_LOAD"
            );
          },

        retriever:
          () => {
            retrieverCalls += 1;

            throw new Error(
              "RETRIEVER_SHOULD_NOT_RUN"
            );
          },
      });

    assert.equal(
      result.model,
      "person-monitor-facts",
    );

    assert.equal(
      result.retrieval.version,
      "deterministic-income-detail-v1",
    );

    assert.deepEqual(
      result.retrieval
        .detected_years,
      [2025],
    );

    assert.equal(
      result.retrieval
        .counts.facts,
      1,
    );

    assert.equal(
      result.retrieval
        .counts.source_documents,
      1,
    );

    assert.match(
      result.answer,
      /Тестова Установа/,
    );

    assert.match(
      result.answer,
      /100 000/,
    );

    assert.match(
      result.answer,
      /declaration-2025/,
    );

    assert.equal(
      subjectCalls,
      1,
    );

    assert.equal(
      incomeCalls,
      1,
    );

    assert.equal(
      knowledgeCalls,
      0,
    );

    assert.equal(
      retrieverCalls,
      0,
    );

    assert.equal(
      modelCalls,
      0,
    );
  },
);

test(
  "falls back to full knowledge pipeline for analytical income detail question",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let incomeCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          return {
            output_text:
              "Аналітична відповідь",
          };
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },

      facts: [],
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 0,
        relations: 0,
        mentions: 0,
        cross_checks: 0,
        source_documents: 0,
      },

      subject:
        fakeKnowledge.subject,

      facts: [],
      relations: [],
      mentions: [],
      cross_checks: [],
      source_documents: [],

      analytics: {
        yearly: [],
        transitions: [],
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Проаналізуй джерела доходу декларанта у 2025 році та оціни ризики",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async () => {
            subjectCalls += 1;

            throw new Error(
              "SUBJECT_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        incomeContextLoader:
          async () => {
            incomeCalls += 1;

            throw new Error(
              "INCOME_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            return fakeKnowledge;
          },

        retriever:
          () => {
            retrieverCalls += 1;

            return fakeContext;
          },
      });

    assert.equal(
      result.answer,
      "Аналітична відповідь",
    );

    assert.equal(
      result.model,
      "test-model",
    );

    assert.equal(
      result.retrieval.version,
      "subject-retrieval-v1",
    );

    assert.equal(
      subjectCalls,
      0,
    );

    assert.equal(
      incomeCalls,
      0,
    );

    assert.equal(
      knowledgeCalls,
      1,
    );

    assert.equal(
      retrieverCalls,
      1,
    );

    assert.equal(
      modelCalls,
      1,
    );
  },
);

test(
  "uses organization relations preflight without loading full subject knowledge",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let organizationCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          throw new Error(
            "MODEL_SHOULD_NOT_BE_CALLED"
          );
        },
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "З якими організаціями був пов’язаний декларант у 2025 році?",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async (subjectId) => {
            subjectCalls += 1;

            assert.equal(
              subjectId,
              "subject-1",
            );

            return {
              id:
                "subject-1",

              entity_id:
                "entity-1",

              full_name:
                "Тестова Особа",
            };
          },

        organizationRelationsContextLoader:
          async (
            entityId,
            year
          ) => {
            organizationCalls += 1;

            assert.equal(
              entityId,
              "entity-1",
            );

            assert.equal(
              year,
              2025,
            );

            return {
              detected_years:
                [2025],

              relations: [
                {
                  relation_type:
                    "third_party_rightsholder",

                  relation_scope:
                    "second_hop",

                  from_entity_type:
                    "asset",

                  from_name:
                    "Квартира · 100 м²",

                  to_entity_type:
                    "organization",

                  to_name:
                    "Тестова Організація",
                },
              ],

              analytics: {
                yearly: [
                  {
                    year:
                      2025,

                    sourceDocumentId:
                      "doc-2025",
                  },
                ],
              },

              source_documents: [
                {
                  id:
                    "doc-2025",

                  url:
                    "https://example.test/declaration-2025",
                },
              ],
            };
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            throw new Error(
              "FULL_KNOWLEDGE_SHOULD_NOT_LOAD"
            );
          },

        retriever:
          () => {
            retrieverCalls += 1;

            throw new Error(
              "RETRIEVER_SHOULD_NOT_RUN"
            );
          },
      });

    assert.equal(
      result.model,
      "person-monitor-facts",
    );

    assert.equal(
      result.retrieval.version,
      "deterministic-organization-relations-v1",
    );

    assert.deepEqual(
      result.retrieval
        .detected_years,
      [2025],
    );

    assert.equal(
      result.retrieval
        .counts.facts,
      0,
    );

    assert.equal(
      result.retrieval
        .counts.relations,
      1,
    );

    assert.equal(
      result.retrieval
        .counts.source_documents,
      1,
    );

    assert.match(
      result.answer,
      /Тестова Організація/,
    );

    assert.match(
      result.answer,
      /Квартира · 100 м²/,
    );

    assert.match(
      result.answer,
      /declaration-2025/,
    );

    assert.equal(
      subjectCalls,
      1,
    );

    assert.equal(
      organizationCalls,
      1,
    );

    assert.equal(
      knowledgeCalls,
      0,
    );

    assert.equal(
      retrieverCalls,
      0,
    );

    assert.equal(
      modelCalls,
      0,
    );
  },
);

test(
  "falls back to full knowledge pipeline for analytical organization relation question",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let organizationCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          return {
            output_text:
              "Аналітична відповідь",
          };
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 0,
        relations: 1,
        mentions: 0,
        cross_checks: 0,
        source_documents: 0,
      },

      subject:
        fakeKnowledge.subject,

      facts: [],

      relations: [
        {
          relation_type:
            "third_party_rightsholder",

          relation_scope:
            "second_hop",

          from_entity_type:
            "asset",

          from_name:
            "Квартира · 100 м²",

          to_entity_type:
            "organization",

          to_name:
            "Тестова Організація",
        },
      ],

      mentions: [],
      cross_checks: [],
      source_documents: [],

      analytics: {
        yearly: [],
        transitions: [],
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Проаналізуй зв’язки декларанта з організаціями у 2025 році та оціни ризики",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async () => {
            subjectCalls += 1;

            throw new Error(
              "SUBJECT_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        organizationRelationsContextLoader:
          async () => {
            organizationCalls += 1;

            throw new Error(
              "ORGANIZATION_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            return fakeKnowledge;
          },

        retriever:
          () => {
            retrieverCalls += 1;

            return fakeContext;
          },
      });

    assert.equal(
      result.answer,
      "Аналітична відповідь",
    );

    assert.equal(
      result.model,
      "test-model",
    );

    assert.equal(
      result.retrieval.version,
      "subject-retrieval-v1",
    );

    assert.equal(
      subjectCalls,
      0,
    );

    assert.equal(
      organizationCalls,
      0,
    );

    assert.equal(
      knowledgeCalls,
      1,
    );

    assert.equal(
      retrieverCalls,
      1,
    );

    assert.equal(
      modelCalls,
      1,
    );
  },
);

test(
  "uses employment preflight without loading full subject knowledge",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let employmentCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          throw new Error(
            "MODEL_SHOULD_NOT_BE_CALLED"
          );
        },
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Яка посада була у 2025 році?",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async (subjectId) => {
            subjectCalls += 1;

            assert.equal(
              subjectId,
              "subject-1",
            );

            return {
              id:
                "subject-1",

              entity_id:
                "entity-1",

              full_name:
                "Тестова Особа",
            };
          },

        employmentContextLoader:
          async (
            entityId,
            year
          ) => {
            employmentCalls += 1;

            assert.equal(
              entityId,
              "entity-1",
            );

            assert.equal(
              year,
              2025,
            );

            return {
              detected_years:
                [2025],

              analytics: {
                yearly: [
                  {
                    year:
                      2025,

                    sourceDocumentId:
                      "doc-2025",
                  },
                ],
              },

              facts: [
                {
                  fact_type:
                    "employment",

                  source_document_id:
                    "doc-2025",

                  metadata: {
                    declaration_year:
                      2025,
                  },

                  value_text:
                    "ТЕСТОВА ПОСАДА",

                  value_json: {
                    person: {
                      role:
                        "declarant",
                    },

                    position:
                      "ТЕСТОВА ПОСАДА",

                    workplace:
                      "ТЕСТОВА УСТАНОВА",

                    responsible_position_exact:
                      "Тестова категорія",
                  },
                },
              ],

              source_documents: [
                {
                  id:
                    "doc-2025",

                  url:
                    "https://example.test/declaration-2025",
                },
              ],
            };
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            throw new Error(
              "FULL_KNOWLEDGE_SHOULD_NOT_LOAD"
            );
          },

        retriever:
          () => {
            retrieverCalls += 1;

            throw new Error(
              "RETRIEVER_SHOULD_NOT_RUN"
            );
          },
      });

    assert.equal(
      result.model,
      "person-monitor-facts",
    );

    assert.equal(
      result.retrieval.version,
      "deterministic-employment-v1",
    );

    assert.deepEqual(
      result.retrieval
        .detected_years,
      [2025],
    );

    assert.equal(
      result.retrieval
        .counts.facts,
      1,
    );

    assert.match(
      result.answer,
      /ТЕСТОВА ПОСАДА/,
    );

    assert.match(
      result.answer,
      /ТЕСТОВА УСТАНОВА/,
    );

    assert.match(
      result.answer,
      /declaration-2025/,
    );

    assert.equal(
      subjectCalls,
      1,
    );

    assert.equal(
      employmentCalls,
      1,
    );

    assert.equal(
      knowledgeCalls,
      0,
    );

    assert.equal(
      retrieverCalls,
      0,
    );

    assert.equal(
      modelCalls,
      0,
    );
  },
);

test(
  "falls back to full knowledge pipeline for analytical employment question",
  async () => {
    let knowledgeCalls = 0;
    let subjectCalls = 0;
    let employmentCalls = 0;
    let retrieverCalls = 0;
    let modelCalls = 0;

    const fakeClient = {
      responses: {
        async create() {
          modelCalls += 1;

          return {
            output_text:
              "Аналітична відповідь",
          };
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 1,
        relations: 0,
        mentions: 0,
        cross_checks: 0,
        source_documents: 0,
      },

      subject:
        fakeKnowledge.subject,

      facts: [
        {
          fact_type:
            "employment",

          metadata: {
            declaration_year:
              2025,
          },

          value_text:
            "ТЕСТОВА ПОСАДА",
        },
      ],

      relations: [],
      mentions: [],
      cross_checks: [],
      source_documents: [],

      analytics: {
        yearly: [],
        transitions: [],
      },
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Проаналізуй посаду у 2025 році та оціни зміни",

        client:
          fakeClient,

        model:
          "test-model",

        subjectLoader:
          async () => {
            subjectCalls += 1;

            throw new Error(
              "SUBJECT_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        employmentContextLoader:
          async () => {
            employmentCalls += 1;

            throw new Error(
              "EMPLOYMENT_PREFLIGHT_SHOULD_NOT_RUN"
            );
          },

        knowledgeLoader:
          async () => {
            knowledgeCalls += 1;

            return fakeKnowledge;
          },

        retriever:
          () => {
            retrieverCalls += 1;

            return fakeContext;
          },
      });

    assert.equal(
      result.answer,
      "Аналітична відповідь",
    );

    assert.equal(
      result.model,
      "test-model",
    );

    assert.equal(
      result.retrieval.version,
      "subject-retrieval-v1",
    );

    assert.equal(
      subjectCalls,
      0,
    );

    assert.equal(
      employmentCalls,
      0,
    );

    assert.equal(
      knowledgeCalls,
      1,
    );

    assert.equal(
      retrieverCalls,
      1,
    );

    assert.equal(
      modelCalls,
      1,
    );
  },
);

test(
  "calls Responses API through injected client",
  async () => {
    let capturedRequest = null;

    const fakeClient = {
      responses: {
        async create(request) {
          capturedRequest =
            request;

          return {
            output_text:
              "Тестова відповідь",
          };
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 2,
        relations: 1,
        mentions: 0,
        cross_checks: 0,
        source_documents: 1,
      },

      subject:
        fakeKnowledge.subject,

      facts: [
        {
          fact_type:
            "income",
          value_number:
            100,
        },
      ],
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Який дохід у 2025?",

        client:
          fakeClient,

        model:
          "test-model",

        knowledgeLoader:
          async () =>
            fakeKnowledge,

        retriever:
          () =>
            fakeContext,
      });

    assert.equal(
      result.answer,
      "Тестова відповідь",
    );

    assert.equal(
      result.model,
      "test-model",
    );

    assert.equal(
      result.retrieval
        .detected_years[0],
      2025,
    );

    assert.ok(
      capturedRequest,
    );

    assert.equal(
      capturedRequest.store,
      false,
    );
  },
);


test(
  "fetches full source document through tool loop",
  async () => {
    const requests = [];

    const fakeClient = {
      responses: {
        async create(request) {
          requests.push(request);

          if (requests.length === 1) {
            const serialized =
              JSON.stringify(request);

            assert.doesNotMatch(
              serialized,
              /PUBLIC_RAW_VALUE/,
            );

            return {
              output_text: "",

              output: [
                {
                  type:
                    "function_call",

                  name:
                    "get_source_document",

                  call_id:
                    "call-source-1",

                  arguments:
                    JSON.stringify({
                      source_document_id:
                        "doc-1",
                    }),
                },
              ],
            };
          }

          if (requests.length === 2) {
            const toolOutput =
              request.input.find(
                (item) =>
                  item.type ===
                    "function_call_output" &&
                  item.call_id ===
                    "call-source-1",
              );

            assert.ok(
              toolOutput,
            );

            assert.match(
              toolOutput.output,
              /PUBLIC_RAW_VALUE/,
            );

            assert.match(
              toolOutput.output,
              /doc-1/,
            );

            return {
              output: [],

              output_text:
                "Повний документ отримано.",
            };
          }

          throw new Error(
            "UNEXPECTED_OPENAI_CALL",
          );
        },
      },
    };

    const fakeKnowledge = {
      subject: {
        full_name:
          "Тестова Особа",
      },
    };

    const fakeContext = {
      retrieval_version:
        "subject-retrieval-v1",

      detected_years:
        [2025],

      counts: {
        facts: 1,
        relations: 0,
        mentions: 0,
        cross_checks: 0,
        source_documents: 1,
      },

      subject:
        fakeKnowledge.subject,

      facts: [
        {
          fact_type:
            "income",

          value_number:
            100,

          source_document_id:
            "doc-1",
        },
      ],

      relations: [],
      mentions: [],
      cross_checks: [],

      source_documents: [
        {
          id:
            "doc-1",

          title:
            "Тестова декларація",

          url:
            "https://example.test/document",

          raw_payload: {
            field:
              "PUBLIC_RAW_VALUE",
          },
        },
      ],
    };

    const result =
      await createSubjectChatResponse({
        subjectId:
          "subject-1",

        message:
          "Перевір повний документ.",

        client:
          fakeClient,

        model:
          "test-model",

        knowledgeLoader:
          async () =>
            fakeKnowledge,

        retriever:
          () =>
            fakeContext,
      });

    assert.equal(
      requests.length,
      2,
    );

    assert.equal(
      result.answer,
      "Повний документ отримано.",
    );
  },
);
