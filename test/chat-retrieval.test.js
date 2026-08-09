import test from "node:test";
import assert from "node:assert/strict";

import {
  retrieveSubjectContext,
} from "../src/chat-retrieval.js";

const knowledge = {
  subject: {
    full_name:
      "Тестова Особа",
  },

  analytics: null,

  facts: [
    {
      id: "f-declaration",
      fact_type:
        "declaration_submission",
      value_text:
        "Декларація за 2024 рік",
      source_document_id: "d1",
    },
    {
      id: "f-income",
      fact_type: "income",
      value_text:
        "Заробітна плата",
      metadata: {
        declaration_year: 2024,
      },
      source_document_id: "d1",
    },
    {
      id: "f-real-estate",
      fact_type: "real_estate",
      value_text: "Квартира",
      metadata: {
        declaration_year: 2025,
      },
      source_document_id: "d2",
    },
  ],

  relations: [
    {
      id: "r-asset",
      relation_type:
        "declared_asset",
      from_name:
        "Тестова Особа",
      to_name:
        "Квартира · Київ",
      metadata: {
        asset_kind:
          "real_estate",
        declaration_year: 2025,
      },
      source_document_id: "d2",
    },
    {
      id: "r-third-party",
      relation_type:
        "third_party_rightsholder",
      from_name:
        "Квартира · Київ",
      to_name:
        "Третя Особа",
      relation_scope:
        "second_hop",
      source_document_id: "d2",
    },
  ],

  mentions: [
    {
      id: "m1",
      title:
        "Судова справа про особу",
      source_document_id: "d3",
    },
  ],

  cross_checks: [
    {
      id: "c-income",
      check_type:
        "income_change",
      details: {
        from_year: 2023,
        to_year: 2024,
        message:
          "Значна зміна доходу",
      },
      source_document_id: "d1",
    },
    {
      id: "c-asset",
      check_type:
        "asset_tracking",
      details: {
        message:
          "Зміна активів",
      },
      source_document_id: "d2",
    },
  ],

  source_documents: [
    {
      id: "d1",
      title:
        "Декларація 2024",
    },
    {
      id: "d2",
      title:
        "Декларація 2025",
    },
    {
      id: "d3",
      title:
        "Судова справа",
    },
  ],
};

test(
  "income intent ranks income above declaration metadata",
  () => {
    const result =
      retrieveSubjectContext(
        knowledge,
        "Як змінилися доходи у 2024 році?",
      );

    assert.equal(
      result.facts[0].fact_type,
      "income",
    );

    assert.equal(
      result.cross_checks[0].check_type,
      "income_change",
    );
  },
);

test(
  "real estate intent ranks real estate data",
  () => {
    const result =
      retrieveSubjectContext(
        knowledge,
        "Яка нерухомість була у 2025 році?",
      );

    assert.equal(
      result.facts[0].fact_type,
      "real_estate",
    );

    assert.equal(
      result.relations[0].relation_type,
      "declared_asset",
    );
  },
);

test(
  "third party intent ranks rightsholder relation first",
  () => {
    const result =
      retrieveSubjectContext(
        knowledge,
        "Які треті особи або правовласники пов’язані з майном?",
      );

    assert.equal(
      result.relations[0].relation_type,
      "third_party_rightsholder",
    );
  },
);

test(
  "non-news questions do not retrieve unrelated mentions",
  () => {
    const result =
      retrieveSubjectContext(
        knowledge,
        "Які треті особи пов’язані з майном?",
      );

    assert.equal(
      result.mentions.length,
      0,
    );
  },
);


test(
  "multi-year query preserves every requested year",
  () => {
    const expandedKnowledge = {
      ...knowledge,

      facts: [
        {
          id: "income-2024-a",
          fact_type: "income",
          value_text: "Заробітна плата",
          metadata: {
            declaration_year: 2024,
          },
        },
        {
          id: "income-2024-b",
          fact_type: "income",
          value_text: "Роялті",
          metadata: {
            declaration_year: 2024,
          },
        },
        {
          id: "income-2025-a",
          fact_type: "income",
          value_text: "Заробітна плата",
          metadata: {
            declaration_year: 2025,
          },
        },
        {
          id: "income-2025-b",
          fact_type: "income",
          value_text: "Роялті",
          metadata: {
            declaration_year: 2025,
          },
        },
      ],
    };

    const result =
      retrieveSubjectContext(
        expandedKnowledge,
        "Порівняй доходи у 2024 та 2025 роках",
        {
          limits: {
            facts: 4,
          },
        },
      );

    const years =
      new Set(
        result.facts.map(
          (item) =>
            item.metadata
              ?.declaration_year,
        ),
      );

    assert.equal(
      years.has(2024),
      true,
    );

    assert.equal(
      years.has(2025),
      true,
    );
  },
);

test(
  "cross checks outside requested years are excluded",
  () => {
    const expandedKnowledge = {
      ...knowledge,

      cross_checks: [
        {
          id: "old-income-check",
          check_type:
            "financial_dynamics",
          details: {
            from_year: 2018,
            to_year: 2019,
            message:
              "Зміна доходу",
          },
        },
        {
          id: "current-income-check",
          check_type:
            "financial_dynamics",
          details: {
            from_year: 2024,
            to_year: 2025,
            message:
              "Зміна доходу",
          },
        },
      ],
    };

    const result =
      retrieveSubjectContext(
        expandedKnowledge,
        "Як змінилися доходи у 2024 та 2025 роках?",
      );

    assert.equal(
      result.cross_checks.length,
      1,
    );

    assert.equal(
      result.cross_checks[0]
        .details.from_year,
      2024,
    );

    assert.equal(
      result.cross_checks[0]
        .details.to_year,
      2025,
    );
  },
);
