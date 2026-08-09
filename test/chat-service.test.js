import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeterministicAnalyticsAnswer,
  buildDeterministicIncomeDetailAnswer,
  buildDeterministicRealEstateAnswer,
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
