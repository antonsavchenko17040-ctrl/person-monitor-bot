const PROVIDER_LABELS = {
  "nazk-declarations": "Реєстр декларацій НАЗК",
  "nazk-corrupt-register": "Реєстр корупціонерів НАЗК",
  "court-open-data": "Судова влада України",
  "court-register": "Єдиний державний реєстр судових рішень",
  "google-news-rss": "Google News",
  "google-web": "Google",
  "official-sites": "Офіційні сайти",
  prozorro: "Prozorro",
};

const PAGE_SIZE = 20;

let activeMentions = [];
let visibleMentions = PAGE_SIZE;

let activeChatSubjectId = null;
let activeChatSubjectName = "";
let activeChatHistory = [];
let chatRequestPending = false;
let chatApiAvailable = null;

let portalAuthenticated = false;
let portalAuthPending = false;

let manualReviewTasks = [];
let manualReviewLoading = false;

const manualReviewPendingTaskIds =
  new Set();

let activeDossierSubjectId = null;
let activeDossierSubjectName = "";
let activeDossierVersion = null;
let activeDossierRequestedVersionId = null;
let dossierEvidenceLoading = false;
let dossierEvidenceMessage = "";

const subjectNameById =
  new Map();

function providerLabel(provider) {
  return PROVIDER_LABELS[provider] ?? provider ?? "Інше джерело";
}

function parseMentionTimestamp(value) {
  if (!value) {
    return 0;
  }

  const ukrainianDate = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);

  if (ukrainianDate) {
    const [, day, month, year] = ukrainianDate;

    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day)
    );
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatMentionDate(value) {
  if (!value) {
    return "";
  }

  const timestamp = parseMentionTimestamp(value);

  if (!timestamp) {
    return value;
  }

  return new Date(timestamp).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function manualReviewStatusLabel(
  value
) {
  if (value === "open") {
    return "Відкрито";
  }

  if (value === "resolved") {
    return "Вирішено";
  }

  if (value === "dismissed") {
    return "Відхилено";
  }

  return String(
    value ?? ""
  );
}


function manualReviewSourceLabel(
  value
) {
  if (
    value ===
    "related_people.items"
  ) {
    return "Пов’язана особа";
  }

  if (
    value ===
    "relations.items"
  ) {
    return "Зв’язок";
  }

  return String(
    value ?? ""
  );
}


function canonicalDossierSources(
  report
) {
  if (
    Array.isArray(
      report?.sources
    )
  ) {
    return report.sources;
  }

  if (
    Array.isArray(
      report?.sources?.items
    )
  ) {
    return report.sources.items;
  }

  return [];
}


function canonicalDossierFindings(
  report
) {
  const items =
    report
      ?.executive_summary
      ?.items;

  return Array.isArray(
    items
  )
    ? items
    : [];
}


function dossierStatementTypeLabel(
  value
) {
  if (
    value ===
    "source_fact"
  ) {
    return "Факт із джерела";
  }

  if (
    value ===
    "calculation"
  ) {
    return "Розрахунок";
  }

  if (
    value ===
    "heuristic_signal"
  ) {
    return "Евристичний сигнал";
  }

  return value
    ? String(value)
    : "Тип твердження не вказано";
}


function canonicalDossierBriefSections(
  report
) {
  const sections =
    report
      ?.analytical_brief
      ?.sections;

  return Array.isArray(
    sections
  )
    ? sections
    : [];
}


function dossierArray(
  value
) {
  return Array.isArray(
    value
  )
    ? value
    : [];
}


function dossierBriefSectionSummary(
  report,
  code
) {
  if (
    code ===
    "overview"
  ) {
    return `${dossierArray(
      report
        ?.declarations
        ?.items
    ).length} декларацій`;
  }

  if (
    code ===
    "key_findings"
  ) {
    return `${canonicalDossierFindings(
      report
    ).length} сигналів`;
  }

  if (
    code ===
    "career_relations"
  ) {
    const total =
      dossierArray(
        report?.career?.items
      ).length +
      dossierArray(
        report
          ?.related_people
          ?.items
      ).length +
      dossierArray(
        report?.relations?.items
      ).length;

    return `${total} записів`;
  }

  if (
    code ===
    "finances"
  ) {
    return (
      `${dossierArray(
        report?.income?.yearly
      ).length} років доходів · ` +
      `${dossierArray(
        report
          ?.cash_assets
          ?.yearly
      ).length} років активів`
    );
  }

  if (
    code ===
    "assets"
  ) {
    const realEstate =
      dossierArray(
        report
          ?.real_estate
          ?.yearly
      ).reduce(
        (total, year) =>
          total +
          dossierArray(
            year?.items
          ).length,
        0
      );

    const vehicles =
      dossierArray(
        report
          ?.vehicles
          ?.yearly
      ).reduce(
        (total, year) =>
          total +
          dossierArray(
            year?.items
          ).length,
        0
      );

    return (
      `${realEstate} нерухомість · ` +
      `${vehicles} транспорт`
    );
  }

  if (
    code ===
    "analytics"
  ) {
    return (
      `${dossierArray(
        report
          ?.analytics
          ?.findings
      ).length} findings · ` +
      `${dossierArray(
        report
          ?.analytics
          ?.transitions
      ).length} змін`
    );
  }

  if (
    code ===
    "media"
  ) {
    return `${dossierArray(
      report?.mentions?.items
    ).length} згадок`;
  }

  if (
    code ===
    "evidence"
  ) {
    return `${canonicalDossierSources(
      report
    ).length} джерел`;
  }

  return "";
}


function renderDossierBriefShell(
  report
) {
  const navigation =
    document.getElementById(
      "dossier-brief-navigation"
    );

  const overview =
    document.getElementById(
      "dossier-brief-overview"
    );

  if (
    !navigation ||
    !overview
  ) {
    return;
  }

  navigation.replaceChildren();
  overview.replaceChildren();

  const sections =
    canonicalDossierBriefSections(
      report
    );

  const targets = {
    overview:
      "dossier-brief-overview",

    key_findings:
      "dossier-evidence-findings",

    career_relations:
      "dossier-career-relations-section",

    finances:
      "dossier-finances-section",

    assets:
      "dossier-assets-section",

    analytics:
      "dossier-analytics-section",

    media:
      "dossier-media-section",

    evidence:
      "dossier-evidence-sources",
  };

  if (
    sections.length === 0
  ) {
    navigation.textContent =
      "Canonical analytical_brief manifest відсутній.";
  }

  for (
    const section
    of sections
  ) {
    const code =
      String(
        section?.code ?? ""
      );

    const targetId =
      targets[code] ||
      null;

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    const summary =
      dossierBriefSectionSummary(
        report,
        code
      );

    button.textContent = [
      section?.title ||
        code ||
        "Розділ",
      summary,
    ]
      .filter(Boolean)
      .join(" · ");

    button.disabled =
      targetId === null;

    button.style.padding =
      "8px 11px";

    button.style.borderRadius =
      "999px";

    button.style.border =
      "1px solid #2a303b";

    button.style.background =
      "#141821";

    button.style.color =
      "inherit";

    button.style.cursor =
      targetId
        ? "pointer"
        : "default";

    button.style.opacity =
      targetId
        ? "1"
        : "0.65";

    if (targetId) {
      button.addEventListener(
        "click",
        () => {
          document
            .getElementById(
              targetId
            )
            ?.scrollIntoView({
              behavior:
                "smooth",

              block:
                "start",
            });
        }
      );
    }

    navigation.append(
      button
    );
  }

  const subject =
    report?.subject &&
    typeof report.subject ===
      "object"
      ? report.subject
      : {};

  const meta =
    report?.meta &&
    typeof report.meta ===
      "object"
      ? report.meta
      : {};

  const heading =
    document.createElement(
      "strong"
    );

  heading.textContent =
    subject.full_name ||
    activeDossierSubjectName ||
    "Профіль суб’єкта";

  heading.style.fontSize =
    "18px";

  overview.append(
    heading
  );

  const rows = [
    [
      "Організація",
      subject.organization,
    ],
    [
      "Посада",
      subject.position,
    ],
    [
      "Місто",
      subject.city,
    ],
    [
      "Період",
      (
        meta?.period?.from_year !=
          null &&
        meta?.period?.to_year !=
          null
      )
        ? `${meta.period.from_year}–${meta.period.to_year}`
        : null,
    ],
    [
      "Доступні роки",
      dossierArray(
        meta.available_years
      ).length
        ? dossierArray(
            meta.available_years
          ).join(", ")
        : null,
    ],
    [
      "Декларації",
      dossierArray(
        report
          ?.declarations
          ?.items
      ).length,
    ],
    [
      "Report schema",
      report.schema_version ||
        meta.schema_version,
    ],
    [
      "Analytical brief",
      report
        ?.analytical_brief
        ?.version,
    ],
  ];

  const grid =
    document.createElement(
      "div"
    );

  grid.style.display =
    "grid";

  grid.style.gridTemplateColumns =
    "repeat(auto-fit, minmax(180px, 1fr))";

  grid.style.gap =
    "12px";

  grid.style.marginTop =
    "14px";

  for (
    const [label, value]
    of rows
  ) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      continue;
    }

    const cell =
      document.createElement(
        "div"
      );

    const cellLabel =
      document.createElement(
        "div"
      );

    cellLabel.className =
      "label";

    cellLabel.textContent =
      label;

    const cellValue =
      document.createElement(
        "div"
      );

    cellValue.style.marginTop =
      "4px";

    cellValue.style.fontWeight =
      "700";

    cellValue.style.wordBreak =
      "break-word";

    cellValue.textContent =
      String(value);

    cell.append(
      cellLabel,
      cellValue
    );

    grid.append(
      cell
    );
  }

  overview.append(
    grid
  );
}


function dossierDisplayValue(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    Array.isArray(value)
  ) {
    const items =
      value
        .filter(
          (item) =>
            item !== null &&
            item !== undefined &&
            typeof item !==
              "object"
        )
        .map(
          (item) =>
            String(item)
        )
        .filter(
          (item) =>
            item.trim() !== ""
        );

    return items.length
      ? items.join(", ")
      : null;
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return value
      ? "Так"
      : "Ні";
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    const text =
      String(value).trim();

    return text === ""
      ? null
      : text;
  }

  return null;
}


function appendDossierField(
  container,
  label,
  value
) {
  const displayValue =
    dossierDisplayValue(
      value
    );

  if (
    displayValue === null
  ) {
    return;
  }

  const row =
    document.createElement(
      "div"
    );

  row.style.marginTop =
    "7px";

  row.style.wordBreak =
    "break-word";

  const strong =
    document.createElement(
      "strong"
    );

  strong.textContent =
    `${label}: `;

  row.append(
    strong,
    document.createTextNode(
      displayValue
    )
  );

  container.append(
    row
  );
}


function createDossierPresentationCard(
  title,
  statementType = null
) {
  const card =
    document.createElement(
      "div"
    );

  card.className =
    "card";

  card.style.padding =
    "14px";

  const top =
    document.createElement(
      "div"
    );

  top.style.display =
    "flex";

  top.style.alignItems =
    "flex-start";

  top.style.justifyContent =
    "space-between";

  top.style.gap =
    "10px";

  const heading =
    document.createElement(
      "strong"
    );

  heading.textContent =
    title ||
    "Запис";

  top.append(
    heading
  );

  if (statementType) {
    const badge =
      document.createElement(
        "span"
      );

    badge.textContent =
      dossierStatementTypeLabel(
        statementType
      );

    badge.style.padding =
      "4px 8px";

    badge.style.border =
      "1px solid #2a303b";

    badge.style.borderRadius =
      "999px";

    badge.style.fontSize =
      "12px";

    badge.style.whiteSpace =
      "nowrap";

    top.append(
      badge
    );
  }

  card.append(
    top
  );

  return card;
}


function renderDossierCareerRelations(
  report
) {
  const container =
    document.getElementById(
      "dossier-career-relations"
    );

  if (!container) {
    return;
  }

  container.replaceChildren();

  const careerItems =
    dossierArray(
      report?.career?.items
    );

  const transitions =
    dossierArray(
      report
        ?.career
        ?.transitions
    );

  const relatedPeople =
    dossierArray(
      report
        ?.related_people
        ?.items
    );

  const relations =
    dossierArray(
      report
        ?.relations
        ?.items
    );

  const total =
    careerItems.length +
    transitions.length +
    relatedPeople.length +
    relations.length;

  if (total === 0) {
    container.textContent =
      "Canonical даних про кар’єру та зв’язки у цьому snapshot немає.";

    return;
  }

  const appendGroup = (
    title,
    items,
    renderItem
  ) => {
    if (
      items.length === 0
    ) {
      return;
    }

    const heading =
      document.createElement(
        "div"
      );

    heading.className =
      "label";

    heading.style.marginTop =
      container.childElementCount
        ? "8px"
        : "0";

    heading.textContent =
      `${title} · ${items.length}`;

    container.append(
      heading
    );

    for (
      const item
      of items
    ) {
      container.append(
        renderItem(item)
      );
    }
  };

  appendGroup(
    "Кар’єрний шлях",
    careerItems,
    (item) => {
      const title = [
        item?.year,
        item?.position,
      ]
        .filter(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        )
        .join(" · ");

      const card =
        createDossierPresentationCard(
          title ||
            "Кар’єрний запис",
          item?.statement_type
        );

      appendDossierField(
        card,
        "Організація",
        item?.organization
      );

      appendDossierField(
        card,
        "Evidence",
        dossierArray(
          item?.evidence
        ).length
      );

      return card;
    }
  );

  appendGroup(
    "Зміни кар’єри",
    transitions,
    (item) => {
      const fromYear =
        item?.from_year ??
        "?";

      const toYear =
        item?.to_year ??
        "?";

      const card =
        createDossierPresentationCard(
          `${fromYear} → ${toYear}`,
          item?.statement_type
        );

      appendDossierField(
        card,
        "Організація змінилась",
        item
          ?.organization_changed
      );

      appendDossierField(
        card,
        "Посада змінилась",
        item
          ?.position_changed
      );

      appendDossierField(
        card,
        "Evidence",
        dossierArray(
          item?.evidence
        ).length
      );

      return card;
    }
  );

  appendGroup(
    "Пов’язані особи",
    relatedPeople,
    (item) => {
      const card =
        createDossierPresentationCard(
          item?.full_name ||
            "Пов’язана особа",
          item?.statement_type
        );

      appendDossierField(
        card,
        "Зв’язок",
        item?.relationship ||
          item?.relation_type
      );

      appendDossierField(
        card,
        "Роль",
        item?.role
      );

      appendDossierField(
        card,
        "Роки",
        item?.years
      );

      appendDossierField(
        card,
        "Identity status",
        item?.identity_status
      );

      appendDossierField(
        card,
        "Потребує review",
        item?.review_required
      );

      appendDossierField(
        card,
        "Source system",
        item
          ?.source_identity
          ?.source_system
      );

      appendDossierField(
        card,
        "Reference",
        item?.item_ref
      );

      appendDossierField(
        card,
        "Evidence",
        dossierArray(
          item?.evidence
        ).length
      );

      return card;
    }
  );

  appendGroup(
    "Canonical relations",
    relations,
    (item) => {
      const card =
        createDossierPresentationCard(
          item?.label ||
            item?.relation_type ||
            "Зв’язок",
          item?.statement_type
        );

      const from =
        item?.from_name ||
        item?.from_entity_id;

      const to =
        item?.to_name ||
        item?.to_entity_id;

      appendDossierField(
        card,
        "Сторони",
        from && to
          ? `${from} → ${to}`
          : from || to
      );

      appendDossierField(
        card,
        "Рік",
        item?.year ??
          (
            item?.relation_scope ===
              "timeless"
              ? "Позачасовий"
              : null
          )
      );

      appendDossierField(
        card,
        "Scope",
        item?.relation_scope
      );

      appendDossierField(
        card,
        "Verification",
        item
          ?.verification_status
      );

      appendDossierField(
        card,
        "Confidence",
        item?.confidence
      );

      appendDossierField(
        card,
        "Relation",
        item?.metadata?.relation
      );

      appendDossierField(
        card,
        "Workplace",
        item
          ?.metadata
          ?.workplace
      );

      appendDossierField(
        card,
        "Position",
        item
          ?.metadata
          ?.position
      );

      appendDossierField(
        card,
        "Організація",
        item
          ?.metadata
          ?.organization_name
      );

      appendDossierField(
        card,
        "ЄДРПОУ",
        item
          ?.metadata
          ?.organization_edrpou
      );

      appendDossierField(
        card,
        "Semantics",
        item
          ?.metadata
          ?.relation_semantics
      );

      appendDossierField(
        card,
        "Потребує review",
        item
          ?.metadata
          ?.review_required
      );

      appendDossierField(
        card,
        "Evidence",
        dossierArray(
          item?.evidence
        ).length
      );

      return card;
    }
  );
}


function dossierFormatNumber(
  value
) {
  if (
    value === null ||
    value === undefined ||
    (
      typeof value === "string" &&
      value.trim() === ""
    )
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return null;
  }

  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits:
        2,
    }
  ).format(number);
}


function dossierFormatAmount(
  value,
  currency = null
) {
  const number =
    dossierFormatNumber(
      value
    );

  if (number === null) {
    return null;
  }

  return currency
    ? `${number} ${currency}`
    : number;
}


function dossierCurrencySummary(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const items =
    Object.entries(value)
      .map(
        ([currency, amount]) => {
          const formatted =
            dossierFormatAmount(
              amount,
              currency
            );

          return formatted;
        }
      )
      .filter(Boolean);

  return items.length
    ? items.join(" · ")
    : null;
}


function dossierOwnerLabel(
  item
) {
  return [
    item?.owner_name,
    item?.owner_role,
    item?.owner_relationship,
  ]
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    )
    .join(" · ") ||
    null;
}


function dossierLocationLabel(
  location
) {
  if (
    !location ||
    typeof location !== "object"
  ) {
    return null;
  }

  return [
    location.country,
    location.region,
    location.district,
    location.city,
  ]
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    )
    .join(", ") ||
    null;
}


function appendDossierGroupHeading(
  container,
  title,
  count
) {
  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "label";

  heading.style.marginTop =
    container.childElementCount
      ? "8px"
      : "0";

  heading.textContent =
    `${title} · ${count}`;

  container.append(
    heading
  );
}


function renderDossierFinances(
  report
) {
  const container =
    document.getElementById(
      "dossier-finances"
    );

  if (!container) {
    return;
  }

  container.replaceChildren();

  const incomeYearly =
    dossierArray(
      report?.income?.yearly
    );

  const incomeSources =
    dossierArray(
      report?.income?.sources
    );

  const cashYearly =
    dossierArray(
      report
        ?.cash_assets
        ?.yearly
    );

  if (
    incomeYearly.length === 0 &&
    incomeSources.length === 0 &&
    cashYearly.length === 0
  ) {
    container.textContent =
      "Canonical фінансових даних у цьому snapshot немає.";

    return;
  }

  if (incomeYearly.length) {
    appendDossierGroupHeading(
      container,
      "Річні доходи",
      incomeYearly.length
    );

    for (
      const item
      of incomeYearly
    ) {
      const card =
        createDossierPresentationCard(
          `${item?.year ?? "?"} · Доходи`,
          item?.statement_type
        );

      appendDossierField(
        card,
        "Декларант",
        dossierFormatAmount(
          item?.declarant_uah,
          "UAH"
        )
      );

      appendDossierField(
        card,
        "Сім’я",
        dossierFormatAmount(
          item?.family_uah,
          "UAH"
        )
      );

      appendDossierField(
        card,
        "Домогосподарство",
        dossierFormatAmount(
          item?.household_uah,
          "UAH"
        )
      );

      appendDossierField(
        card,
        "Source document",
        item?.source_document_id
      );

      appendDossierField(
        card,
        "Evidence",
        dossierArray(
          item?.evidence
        ).length
      );

      container.append(
        card
      );
    }
  }

  if (incomeSources.length) {
    appendDossierGroupHeading(
      container,
      "Джерела доходу",
      incomeSources.length
    );

    for (
      const item
      of incomeSources
    ) {
      const card =
        createDossierPresentationCard(
          [
            item?.year,
            item?.income_type ||
              item?.other_income_type ||
              "Дохід",
          ]
            .filter(Boolean)
            .join(" · "),
          item?.statement_type
        );

      appendDossierField(
        card,
        "Сума",
        dossierFormatAmount(
          item?.amount,
          item?.currency
        )
      );

      appendDossierField(
        card,
        "Отримувач",
        [
          item?.recipient_name,
          item?.recipient_role,
          item?.recipient_relationship,
        ]
          .filter(Boolean)
          .join(" · ") ||
          null
      );

      appendDossierField(
        card,
        "Джерело",
        item?.source
      );

      appendDossierField(
        card,
        "Тип джерела",
        item
          ?.source_details
          ?.source_type
      );

      appendDossierField(
        card,
        "Компанія",
        item
          ?.source_details
          ?.company_name ||
          item
            ?.source_details
            ?.foreign_company_name
      );

      appendDossierField(
        card,
        "ЄДРПОУ / код",
        item
          ?.source_details
          ?.edrpou ||
          item
            ?.source_details
            ?.foreign_company_code
      );

      appendDossierField(
        card,
        "Особа-джерело",
        item
          ?.source_details
          ?.person_name
      );

      appendDossierField(
        card,
        "Source document",
        item?.source_document_id
      );

      appendDossierField(
        card,
        "Evidence",
        dossierArray(
          item?.evidence
        ).length
      );

      container.append(
        card
      );
    }
  }

  if (cashYearly.length) {
    const cashItems =
      cashYearly.reduce(
        (total, year) =>
          total +
          dossierArray(
            year?.items
          ).length,
        0
      );

    appendDossierGroupHeading(
      container,
      "Грошові активи",
      cashItems
    );

    for (
      const year
      of cashYearly
    ) {
      const summary =
        createDossierPresentationCard(
          `${year?.year ?? "?"} · Підсумок грошових активів`,
          year
            ?.evidence
            ?.[0]
            ?.statement_type ||
            "calculation"
        );

      appendDossierField(
        summary,
        "Декларант",
        dossierCurrencySummary(
          year
            ?.declarant_by_currency
        )
      );

      appendDossierField(
        summary,
        "Домогосподарство",
        dossierCurrencySummary(
          year
            ?.household_by_currency
        )
      );

      appendDossierField(
        summary,
        "Позицій",
        dossierArray(
          year?.items
        ).length
      );

      appendDossierField(
        summary,
        "Evidence",
        dossierArray(
          year?.evidence
        ).length
      );

      container.append(
        summary
      );

      for (
        const item
        of dossierArray(
          year?.items
        )
      ) {
        const card =
          createDossierPresentationCard(
            [
              year?.year,
              item?.asset_type ||
                item?.other_asset_type ||
                "Грошовий актив",
            ]
              .filter(Boolean)
              .join(" · "),
            item?.statement_type
          );

        appendDossierField(
          card,
          "Сума",
          dossierFormatAmount(
            item?.amount,
            item?.currency ||
              item?.currency_raw
          )
        );

        appendDossierField(
          card,
          "Організація",
          item?.organization_name
        );

        appendDossierField(
          card,
          "Тип організації",
          item?.organization_type
        );

        appendDossierField(
          card,
          "Власник",
          dossierOwnerLabel(
            item
          )
        );

        appendDossierField(
          card,
          "Прав",
          dossierArray(
            item?.rights
          ).length
        );

        appendDossierField(
          card,
          "Source document",
          item?.source_document_id
        );

        appendDossierField(
          card,
          "Evidence",
          dossierArray(
            item?.evidence
          ).length
        );

        container.append(
          card
        );
      }
    }
  }
}


function renderDossierAssets(
  report
) {
  const container =
    document.getElementById(
      "dossier-assets"
    );

  if (!container) {
    return;
  }

  container.replaceChildren();

  const realEstateYearly =
    dossierArray(
      report
        ?.real_estate
        ?.yearly
    );

  const vehicleYearly =
    dossierArray(
      report
        ?.vehicles
        ?.yearly
    );

  const realEstateCount =
    realEstateYearly.reduce(
      (total, year) =>
        total +
        dossierArray(
          year?.items
        ).length,
      0
    );

  const vehicleCount =
    vehicleYearly.reduce(
      (total, year) =>
        total +
        dossierArray(
          year?.items
        ).length,
      0
    );

  if (
    realEstateCount === 0 &&
    vehicleCount === 0
  ) {
    container.textContent =
      "Canonical даних про нерухомість і транспорт у цьому snapshot немає.";

    return;
  }

  if (realEstateCount) {
    appendDossierGroupHeading(
      container,
      "Нерухомість",
      realEstateCount
    );

    for (
      const year
      of realEstateYearly
    ) {
      for (
        const item
        of dossierArray(
          year?.items
        )
      ) {
        const card =
          createDossierPresentationCard(
            [
              year?.year,
              item?.object_type ||
                item?.other_object_type ||
                "Об’єкт нерухомості",
            ]
              .filter(Boolean)
              .join(" · "),
            item?.statement_type
          );

        const area =
          dossierFormatNumber(
            item?.area
          );

        appendDossierField(
          card,
          "Площа",
          area
            ? [
                area,
                item?.area_unit,
              ]
                .filter(Boolean)
                .join(" ")
            : null
        );

        appendDossierField(
          card,
          "Локація",
          dossierLocationLabel(
            item?.location
          )
        );

        appendDossierField(
          card,
          "Дата набуття",
          item?.acquisition_date
        );

        appendDossierField(
          card,
          "Вартість",
          dossierFormatNumber(
            item?.cost
          )
        );

        appendDossierField(
          card,
          "Власник",
          dossierOwnerLabel(
            item
          )
        );

        appendDossierField(
          card,
          "Прав",
          dossierArray(
            item?.rights
          ).length
        );

        appendDossierField(
          card,
          "Source item ref",
          item
            ?.tracking_identity
            ?.source_item_ref
        );

        appendDossierField(
          card,
          "Source document",
          item?.source_document_id
        );

        appendDossierField(
          card,
          "Evidence",
          dossierArray(
            item?.evidence
          ).length
        );

        container.append(
          card
        );
      }
    }
  }

  if (vehicleCount) {
    appendDossierGroupHeading(
      container,
      "Транспорт",
      vehicleCount
    );

    for (
      const year
      of vehicleYearly
    ) {
      for (
        const item
        of dossierArray(
          year?.items
        )
      ) {
        const vehicleName =
          [
            item?.brand,
            item?.model,
          ]
            .filter(Boolean)
            .join(" ");

        const card =
          createDossierPresentationCard(
            [
              year?.year,
              vehicleName ||
                item?.object_type ||
                item?.other_object_type ||
                "Транспорт",
            ]
              .filter(Boolean)
              .join(" · "),
            item?.statement_type
          );

        appendDossierField(
          card,
          "Тип",
          item?.object_type ||
            item?.other_object_type
        );

        appendDossierField(
          card,
          "Рік випуску",
          item?.production_year
        );

        appendDossierField(
          card,
          "Дата набуття",
          item?.acquisition_date
        );

        appendDossierField(
          card,
          "Вартість",
          dossierFormatNumber(
            item?.cost
          )
        );

        appendDossierField(
          card,
          "Власник",
          dossierOwnerLabel(
            item
          )
        );

        appendDossierField(
          card,
          "Прав",
          dossierArray(
            item?.rights
          ).length
        );

        appendDossierField(
          card,
          "Source item ref",
          item
            ?.tracking_identity
            ?.source_item_ref
        );

        appendDossierField(
          card,
          "Source document",
          item?.source_document_id
        );

        appendDossierField(
          card,
          "Evidence",
          dossierArray(
            item?.evidence
          ).length
        );

        container.append(
          card
        );
      }
    }
  }
}


function dossierFormatPercent(
  value
) {
  const formatted =
    dossierFormatNumber(
      value
    );

  return formatted === null
    ? null
    : `${formatted}%`;
}


function appendDossierAnalyticsDetails(
  card,
  details
) {
  if (
    !details ||
    typeof details !== "object" ||
    Array.isArray(details)
  ) {
    return;
  }

  const fromYear =
    details.from_year;

  const toYear =
    details.to_year;

  appendDossierField(
    card,
    "Період",
    (
      fromYear !== null &&
      fromYear !== undefined &&
      toYear !== null &&
      toYear !== undefined
    )
      ? `${fromYear} → ${toYear}`
      : null
  );

  appendDossierField(
    card,
    "Приріст cash",
    dossierFormatAmount(
      details.cash_uah_delta,
      "UAH"
    )
  );

  appendDossierField(
    card,
    "Поточний дохід",
    dossierFormatAmount(
      details.current_income_uah,
      "UAH"
    )
  );

  appendDossierField(
    card,
    "Ratio",
    dossierFormatNumber(
      details.ratio
    )
  );

  appendDossierField(
    card,
    "Зміна доходу",
    dossierFormatAmount(
      details.income_delta_uah,
      "UAH"
    )
  );

  appendDossierField(
    card,
    "Зміна доходу",
    dossierFormatPercent(
      details.income_delta_percent
    )
  );

  appendDossierField(
    card,
    "Зміна кількості",
    dossierFormatNumber(
      details.count_delta
    )
  );

  appendDossierField(
    card,
    "Було",
    dossierFormatNumber(
      details.previous_count
    )
  );

  appendDossierField(
    card,
    "Стало",
    dossierFormatNumber(
      details.current_count
    )
  );

  appendDossierField(
    card,
    "Організація змінилась",
    details.organization_changed
  );

  appendDossierField(
    card,
    "Посада змінилась",
    details.position_changed
  );
}


function renderDossierAnalytics(
  report
) {
  const container =
    document.getElementById(
      "dossier-analytics"
    );

  if (!container) {
    return;
  }

  container.replaceChildren();

  const metrics =
    dossierArray(
      report?.analytics?.metrics
    );

  const transitions =
    dossierArray(
      report
        ?.analytics
        ?.transitions
    );

  const findings =
    dossierArray(
      report
        ?.analytics
        ?.findings
    );

  if (
    metrics.length === 0 &&
    transitions.length === 0 &&
    findings.length === 0
  ) {
    container.textContent =
      "Canonical аналітичних метрик і змін у цьому snapshot немає.";

    return;
  }

  if (metrics.length) {
    appendDossierGroupHeading(
      container,
      "Річні метрики",
      metrics.length
    );

    for (
      const item
      of metrics
    ) {
      const card =
        createDossierPresentationCard(
          `${item?.year ?? "?"} · Річні метрики`,
          item?.statement_type
        );

      appendDossierField(
        card,
        "Дохід декларанта",
        dossierFormatAmount(
          item?.income_declarant_uah,
          "UAH"
        )
      );

      appendDossierField(
        card,
        "Дохід домогосподарства",
        dossierFormatAmount(
          item?.income_household_uah,
          "UAH"
        )
      );

      appendDossierField(
        card,
        "Cash декларанта",
        dossierCurrencySummary(
          item
            ?.cash_declarant_by_currency
        )
      );

      appendDossierField(
        card,
        "Cash домогосподарства",
        dossierCurrencySummary(
          item
            ?.cash_household_by_currency
        )
      );

      appendDossierField(
        card,
        "Нерухомість",
        item?.real_estate_items
      );

      appendDossierField(
        card,
        "Транспорт",
        item?.vehicle_items
      );

      appendDossierField(
        card,
        "Зв’язки",
        item?.relation_count
      );

      appendDossierField(
        card,
        "Організація",
        item?.career?.organization
      );

      appendDossierField(
        card,
        "Посада",
        item?.career?.position
      );

      appendDossierField(
        card,
        "Evidence",
        dossierArray(
          item?.evidence
        ).length
      );

      container.append(
        card
      );
    }
  }

  if (transitions.length) {
    appendDossierGroupHeading(
      container,
      "Річні зміни",
      transitions.length
    );

    for (
      const item
      of transitions
    ) {
      const card =
        createDossierPresentationCard(
          `${item?.from_year ?? "?"} → ${item?.to_year ?? "?"}`,
          item?.statement_type
        );

      appendDossierField(
        card,
        "Крок років",
        item?.year_gap
      );

      appendDossierField(
        card,
        "Δ дохід",
        dossierFormatAmount(
          item?.income_delta_uah,
          "UAH"
        )
      );

      appendDossierField(
        card,
        "Δ дохід",
        dossierFormatPercent(
          item
            ?.income_delta_percent
        )
      );

      appendDossierField(
        card,
        "Δ cash",
        dossierFormatAmount(
          item?.cash_uah_delta,
          "UAH"
        )
      );

      appendDossierField(
        card,
        "Δ нерухомість",
        item
          ?.real_estate_count_delta
      );

      appendDossierField(
        card,
        "Δ транспорт",
        item
          ?.vehicle_count_delta
      );

      appendDossierField(
        card,
        "Організація змінилась",
        item
          ?.organization_changed
      );

      appendDossierField(
        card,
        "Посада змінилась",
        item
          ?.position_changed
      );

      appendDossierField(
        card,
        "Evidence",
        dossierArray(
          item?.evidence
        ).length
      );

      container.append(
        card
      );
    }
  }

  if (findings.length) {
    appendDossierGroupHeading(
      container,
      "Аналітичні сигнали",
      findings.length
    );

    for (
      const item
      of findings
    ) {
      const card =
        createDossierPresentationCard(
          item?.message ||
            item?.rule_code ||
            "Аналітичний сигнал",
          item?.statement_type
        );

      appendDossierField(
        card,
        "Rule",
        item?.rule_code
      );

      appendDossierField(
        card,
        "Domain",
        item?.domain
      );

      appendDossierField(
        card,
        "Result",
        item?.result
      );

      appendDossierField(
        card,
        "Severity",
        item?.severity
      );

      appendDossierField(
        card,
        "Score",
        item?.score
      );

      appendDossierAnalyticsDetails(
        card,
        item?.details
      );

      appendDossierField(
        card,
        "Evidence",
        dossierArray(
          item?.evidence
        ).length
      );

      container.append(
        card
      );
    }
  }
}


function dossierSafeSnippet(
  value,
  maxLength = 360
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  if (
    text.length <= maxLength
  ) {
    return text;
  }

  return (
    text.slice(
      0,
      maxLength
    ).trimEnd() +
    "…"
  );
}


function appendDossierSourceLink(
  container,
  source
) {
  const url =
    source?.url;

  if (
    typeof url !== "string" ||
    !url.trim()
  ) {
    return;
  }

  const row =
    document.createElement(
      "div"
    );

  row.style.marginTop =
    "9px";

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.target =
    "_blank";

  link.rel =
    "noopener noreferrer";

  link.textContent =
    "Відкрити canonical джерело";

  row.append(
    link
  );

  container.append(
    row
  );
}


function renderDossierMedia(
  report
) {
  const container =
    document.getElementById(
      "dossier-media"
    );

  if (!container) {
    return;
  }

  container.replaceChildren();

  const mentions =
    dossierArray(
      report?.mentions?.items
    );

  if (
    mentions.length === 0
  ) {
    container.textContent =
      "Canonical релевантних згадок у цьому snapshot немає.";

    return;
  }

  const sourcesById =
    new Map(
      canonicalDossierSources(
        report
      )
        .filter(
          (source) =>
            source
              ?.source_document_id !=
            null
        )
        .map(
          (source) => [
            String(
              source
                .source_document_id
            ),
            source,
          ]
        )
    );

  appendDossierGroupHeading(
    container,
    "Згадки",
    mentions.length
  );

  for (
    const item
    of mentions
  ) {
    const sourceId =
      item
        ?.source_document_id !=
      null
        ? String(
            item
              .source_document_id
          )
        : null;

    const source =
      sourceId
        ? sourcesById.get(
            sourceId
          ) || null
        : null;

    const card =
      createDossierPresentationCard(
        item?.title ||
          "Медійна згадка"
      );

    appendDossierField(
      card,
      "Provider",
      source?.provider ||
        item?.provider
    );

    appendDossierField(
      card,
      "Джерело",
      item?.source
    );

    appendDossierField(
      card,
      "Опубліковано",
      item?.published_at
        ? formatPortalDateTime(
            item.published_at
          )
        : null
    );

    appendDossierField(
      card,
      "Вперше зафіксовано",
      item?.first_seen_at
        ? formatPortalDateTime(
            item.first_seen_at
          )
        : null
    );

    appendDossierField(
      card,
      "Match level",
      item?.match_level
    );

    appendDossierField(
      card,
      "Match score",
      item?.match_score
    );

    const snippet =
      dossierSafeSnippet(
        item?.snippet
      );

    appendDossierField(
      card,
      "Фрагмент",
      snippet
    );

    appendDossierField(
      card,
      "Source document",
      sourceId
    );

    appendDossierSourceLink(
      card,
      source
    );

    container.append(
      card
    );
  }
}


function renderDossierEvidence() {
  const title =
    document.getElementById(
      "dossier-evidence-title"
    );

  const status =
    document.getElementById(
      "dossier-evidence-status"
    );

  const meta =
    document.getElementById(
      "dossier-evidence-meta"
    );

  const briefNavigation =
    document.getElementById(
      "dossier-brief-navigation"
    );

  const briefOverview =
    document.getElementById(
      "dossier-brief-overview"
    );

  const careerRelations =
    document.getElementById(
      "dossier-career-relations"
    );

  const finances =
    document.getElementById(
      "dossier-finances"
    );

  const assets =
    document.getElementById(
      "dossier-assets"
    );

  const analytics =
    document.getElementById(
      "dossier-analytics"
    );

  const media =
    document.getElementById(
      "dossier-media"
    );

  const findingsContainer =
    document.getElementById(
      "dossier-evidence-findings"
    );

  const sourcesContainer =
    document.getElementById(
      "dossier-evidence-sources"
    );

  const refresh =
    document.getElementById(
      "dossier-evidence-refresh"
    );

  if (
    !status ||
    !meta ||
    !briefNavigation ||
    !briefOverview ||
    !careerRelations ||
    !finances ||
    !assets ||
    !analytics ||
    !media ||
    !findingsContainer ||
    !sourcesContainer
  ) {
    return;
  }

  if (title) {
    title.textContent =
      activeDossierSubjectName
        ? `Аналітичне досьє: ${activeDossierSubjectName}`
        : "Аналітичне досьє";
  }

  if (refresh) {
    refresh.disabled =
      !portalAuthenticated ||
      !activeDossierSubjectId ||
      dossierEvidenceLoading;

    refresh.textContent =
      dossierEvidenceLoading
        ? "Завантаження…"
        : "Оновити перегляд";
  }

  meta.replaceChildren();
  briefNavigation.replaceChildren();
  briefOverview.replaceChildren();
  careerRelations.replaceChildren();
  finances.replaceChildren();
  assets.replaceChildren();
  analytics.replaceChildren();
  media.replaceChildren();
  findingsContainer.replaceChildren();
  sourcesContainer.replaceChildren();

  if (!activeDossierSubjectId) {
    status.textContent =
      "Оберіть суб’єкта моніторингу.";

    return;
  }

  if (!portalAuthenticated) {
    status.textContent =
      "Увійдіть у режим аналітика для перегляду persisted dossier.";

    return;
  }

  if (dossierEvidenceLoading) {
    status.textContent =
      activeDossierRequestedVersionId
        ? "Завантаження exact persisted snapshot…"
        : "Завантаження останнього persisted snapshot…";

    return;
  }

  if (!activeDossierVersion) {
    status.textContent =
      dossierEvidenceMessage ||
      "Збереженого dossier snapshot для цього суб’єкта ще немає.";

    return;
  }

  const version =
    activeDossierVersion;

  const report =
    version.report_payload &&
    typeof version.report_payload ===
      "object"
      ? version.report_payload
      : {};

  status.textContent =
    dossierEvidenceMessage ||
    (
      activeDossierRequestedVersionId
        ? "Завантажено exact persisted dossier snapshot."
        : "Завантажено останній persisted dossier snapshot."
    );

  const metadata = [
    [
      "Dossier version",
      version.id,
    ],
    [
      "Статус",
      version.dossier_status,
    ],
    [
      "Створено",
      version.created_at
        ? formatPortalDateTime(
            version.created_at
          )
        : null,
    ],
    [
      "Report schema",
      version.report_schema_version,
    ],
    [
      "Generated at",
      version.report_generated_at
        ? formatPortalDateTime(
            version.report_generated_at
          )
        : null,
    ],
    [
      "Hash version",
      version.report_payload_hash_version,
    ],
    [
      "SHA-256",
      version.report_payload_hash,
    ],
  ];

  for (
    const [label, value]
    of metadata
  ) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      continue;
    }

    const row =
      document.createElement(
        "div"
      );

    row.style.wordBreak =
      "break-word";

    const strong =
      document.createElement(
        "strong"
      );

    strong.textContent =
      `${label}: `;

    row.append(
      strong,
      document.createTextNode(
        String(value)
      )
    );

    meta.append(
      row
    );
  }

  renderDossierBriefShell(
    report
  );

  renderDossierCareerRelations(
    report
  );

  renderDossierFinances(
    report
  );

  renderDossierAssets(
    report
  );

  renderDossierAnalytics(
    report
  );

  renderDossierMedia(
    report
  );

  const sources =
    canonicalDossierSources(
      report
    );

  const sourcesById =
    new Map(
      sources
        .filter(
          (source) =>
            source
              ?.source_document_id !=
            null
        )
        .map(
          (source) => [
            String(
              source
                .source_document_id
            ),
            source,
          ]
        )
    );

  const findings =
    canonicalDossierFindings(
      report
    );

  if (
    findings.length === 0
  ) {
    findingsContainer.textContent =
      "Ключових сигналів із canonical evidence у цьому snapshot немає.";
  } else {
    for (
      const finding
      of findings
    ) {
      const card =
        document.createElement(
          "div"
        );

      card.className =
        "card";

      card.style.padding =
        "16px";

      const top =
        document.createElement(
          "div"
        );

      top.style.display =
        "flex";

      top.style.alignItems =
        "flex-start";

      top.style.justifyContent =
        "space-between";

      top.style.gap =
        "12px";

      const message =
        document.createElement(
          "strong"
        );

      message.textContent =
        finding.message ||
        finding.rule_code ||
        "Аналітичний сигнал";

      const statementBadge =
        document.createElement(
          "span"
        );

      statementBadge.textContent =
        dossierStatementTypeLabel(
          finding.statement_type
        );

      statementBadge.style.padding =
        "5px 9px";

      statementBadge.style.border =
        "1px solid #2a303b";

      statementBadge.style.borderRadius =
        "999px";

      statementBadge.style.fontSize =
        "12px";

      statementBadge.style.whiteSpace =
        "nowrap";

      top.append(
        message,
        statementBadge
      );

      const findingMeta =
        document.createElement(
          "div"
        );

      findingMeta.className =
        "label";

      findingMeta.style.marginTop =
        "8px";

      findingMeta.textContent = [
        finding.rule_code,
        finding.domain,
        finding.severity
          ? `severity: ${finding.severity}`
          : null,
        finding.score !== null &&
        finding.score !== undefined
          ? `score: ${finding.score}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");

      card.append(
        top,
        findingMeta
      );

      if (
        finding.details &&
        typeof finding.details ===
          "object" &&
        !Array.isArray(
          finding.details
        )
      ) {
        const detailEntries =
          Object.entries(
            finding.details
          );

        if (
          detailEntries.length > 0
        ) {
          const details =
            document.createElement(
              "div"
            );

          details.className =
            "label";

          details.style.marginTop =
            "8px";

          details.textContent =
            detailEntries
              .map(
                ([key, value]) =>
                  `${key}: ${String(value)}`
              )
              .join(" · ");

          card.append(
            details
          );
        }
      }

      const evidenceItems =
        Array.isArray(
          finding.evidence
        )
          ? finding.evidence
          : [];

      const evidenceHeading =
        document.createElement(
          "div"
        );

      evidenceHeading.style.marginTop =
        "14px";

      evidenceHeading.style.fontWeight =
        "700";

      evidenceHeading.textContent =
        `Evidence: ${evidenceItems.length}`;

      card.append(
        evidenceHeading
      );

      if (
        evidenceItems.length === 0
      ) {
        const empty =
          document.createElement(
            "div"
          );

        empty.className =
          "label";

        empty.style.marginTop =
          "8px";

        empty.textContent =
          "Canonical evidence для цього сигналу відсутнє.";

        card.append(
          empty
        );
      }

      for (
        const evidence
        of evidenceItems
      ) {
        const sourceId =
          evidence
            ?.source_document_id !=
          null
            ? String(
                evidence
                  .source_document_id
              )
            : null;

        const source =
          sourceId
            ? sourcesById.get(
                sourceId
              )
            : null;

        const evidenceCard =
          document.createElement(
            "div"
          );

        evidenceCard.style.marginTop =
          "10px";

        evidenceCard.style.padding =
          "12px";

        evidenceCard.style.border =
          "1px solid #2a303b";

        evidenceCard.style.borderRadius =
          "10px";

        const sourceHeading =
          document.createElement(
            "strong"
          );

        sourceHeading.textContent =
          source?.title ||
          (
            source?.provider
              ? providerLabel(
                  source.provider
                )
              : null
          ) ||
          source?.source_type ||
          "Canonical source";

        const evidenceType =
          document.createElement(
            "div"
          );

        evidenceType.className =
          "label";

        evidenceType.style.marginTop =
          "6px";

        evidenceType.textContent = [
          dossierStatementTypeLabel(
            evidence
              ?.statement_type
          ),
          source?.provider
            ? providerLabel(
                source.provider
              )
            : null,
          source?.source_type ||
            null,
        ]
          .filter(Boolean)
          .join(" · ");

        const reference =
          document.createElement(
            "div"
          );

        reference.className =
          "label";

        reference.style.marginTop =
          "6px";

        reference.style.wordBreak =
          "break-all";

        reference.textContent =
          sourceId
            ? `Source document: ${sourceId}`
            : "Source document ID відсутній";

        evidenceCard.append(
          sourceHeading,
          evidenceType,
          reference
        );

        if (!source) {
          const unresolved =
            document.createElement(
              "div"
            );

          unresolved.className =
            "label";

          unresolved.style.marginTop =
            "6px";

          unresolved.textContent =
            "Canonical source record не знайдено.";

          evidenceCard.append(
            unresolved
          );
        }

        if (source?.url) {
          const link =
            document.createElement(
              "a"
            );

          link.href =
            source.url;

          link.target =
            "_blank";

          link.rel =
            "noopener noreferrer";

          link.textContent =
            "Відкрити canonical source";

          link.style.display =
            "inline-block";

          link.style.marginTop =
            "8px";

          link.style.color =
            "inherit";

          evidenceCard.append(
            link
          );
        }

        card.append(
          evidenceCard
        );
      }

      findingsContainer.append(
        card
      );
    }
  }

  if (sources.length === 0) {
    sourcesContainer.textContent =
      "Canonical sources у цьому snapshot відсутні.";

    return;
  }

  for (
    const source
    of sources
  ) {
    const card =
      document.createElement(
        "div"
      );

    card.className =
      "card";

    card.style.padding =
      "16px";

    const heading =
      document.createElement(
        "strong"
      );

    heading.textContent =
      source.title ||
      providerLabel(
        source.provider
      ) ||
      source.source_type ||
      "Джерело";

    const details =
      document.createElement(
        "div"
      );

    details.className =
      "label";

    details.style.marginTop =
      "8px";

    const parts = [
      source.provider
        ? providerLabel(
            source.provider
          )
        : null,
      source.source_type,
      source.published_at
        ? `опубліковано ${formatPortalDateTime(
            source.published_at
          )}`
        : null,
      source.observed_at
        ? `отримано ${formatPortalDateTime(
            source.observed_at
          )}`
        : null,
    ].filter(Boolean);

    details.textContent =
      parts.join(" · ");

    const reference =
      document.createElement(
        "div"
      );

    reference.className =
      "label";

    reference.style.marginTop =
      "8px";

    reference.style.wordBreak =
      "break-all";

    reference.textContent =
      source.source_document_id
        ? `Source document: ${source.source_document_id}`
        : source.external_id
          ? `External ID: ${source.external_id}`
          : "Source ID відсутній";

    card.append(
      heading,
      details,
      reference
    );

    if (source.url) {
      const link =
        document.createElement(
          "a"
        );

      link.href =
        source.url;

      link.target =
        "_blank";

      link.rel =
        "noopener noreferrer";

      link.textContent =
        "Відкрити джерело";

      link.style.display =
        "inline-block";

      link.style.marginTop =
        "10px";

      link.style.color =
        "inherit";

      card.append(
        link
      );
    }

    sourcesContainer.append(
      card
    );
  }
}


async function loadDossierEvidence(
  subjectId,
  fullName,
  dossierVersionId = null
) {
  if (
    !portalAuthenticated ||
    !subjectId
  ) {
    return;
  }

  activeDossierSubjectId =
    subjectId;

  activeDossierSubjectName =
    fullName ||
    subjectNameById.get(
      subjectId
    ) ||
    subjectId;

  dossierEvidenceLoading =
    true;

  dossierEvidenceMessage =
    "";

  activeDossierVersion =
    null;

  activeDossierRequestedVersionId =
    dossierVersionId ||
    null;

  renderDossierEvidence();

  try {
    const params =
      new URLSearchParams();

    if (
      activeDossierRequestedVersionId
    ) {
      params.set(
        "dossierVersionId",
        activeDossierRequestedVersionId
      );
    } else {
      params.set(
        "subjectId",
        subjectId
      );
    }

    const response =
      await fetch(
        `/api/dossier-version?${params.toString()}`,
        {
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {}

    if (
      response.status === 401
    ) {
      portalAuthenticated =
        false;

      applyPortalAuthState();

      dossierEvidenceMessage =
        "Сесія завершилась. Увійдіть повторно.";

      return;
    }

    if (
      response.status === 404
    ) {
      dossierEvidenceMessage =
        activeDossierRequestedVersionId
          ? "Вказану persisted версію досьє не знайдено."
          : "Persisted dossier snapshot для цього суб’єкта ще не створено.";

      return;
    }

    if (
      !response.ok ||
      data?.ok !== true
    ) {
      throw new Error(
        data?.error ||
        `HTTP ${response.status}`
      );
    }

    activeDossierVersion =
      data.dossierVersion ||
      null;
  } catch (error) {
    console.error(
      "Dossier evidence loading failed:",
      error
    );

    dossierEvidenceMessage =
      error?.message ||
      "Не вдалося завантажити dossier snapshot.";
  } finally {
    dossierEvidenceLoading =
      false;

    renderDossierEvidence();
  }
}


function populateManualReviewSubjectFilter() {
  const select =
    document.getElementById(
      "manual-review-subject-filter"
    );

  if (!select) {
    return;
  }

  const selected =
    select.value;

  select.replaceChildren();

  const all =
    document.createElement(
      "option"
    );

  all.value = "";
  all.textContent =
    "Усі суб’єкти";

  select.append(
    all
  );

  const entries =
    [...subjectNameById.entries()]
      .sort(
        (left, right) =>
          String(left[1])
            .localeCompare(
              String(right[1]),
              "uk-UA"
            )
      );

  for (
    const [
      subjectId,
      fullName,
    ]
    of entries
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      subjectId;

    option.textContent =
      fullName ||
      subjectId;

    select.append(
      option
    );
  }

  if (
    [...select.options]
      .some(
        (option) =>
          option.value ===
          selected
      )
  ) {
    select.value =
      selected;
  }
}


function renderManualReviewQueue() {
  const container =
    document.getElementById(
      "manual-review-list"
    );

  const summary =
    document.getElementById(
      "manual-review-summary"
    );

  const refresh =
    document.getElementById(
      "manual-review-refresh"
    );

  if (!container) {
    return;
  }

  if (refresh) {
    refresh.disabled =
      manualReviewLoading;

    refresh.textContent =
      manualReviewLoading
        ? "Завантаження…"
        : "Оновити";
  }

  if (manualReviewLoading) {
    container.textContent =
      "Завантаження черги…";

    if (summary) {
      summary.textContent = "";
    }

    return;
  }

  container.replaceChildren();

  if (
    manualReviewTasks.length === 0
  ) {
    container.textContent =
      "Завдань за вибраними фільтрами немає.";

    if (summary) {
      summary.textContent =
        "0 завдань";
    }

    return;
  }

  if (summary) {
    summary.textContent =
      `${manualReviewTasks.length} завдань`;
  }

  for (
    const task
    of manualReviewTasks
  ) {
    const card =
      document.createElement(
        "div"
      );

    card.className =
      "card";

    const top =
      document.createElement(
        "div"
      );

    top.style.display =
      "flex";

    top.style.alignItems =
      "flex-start";

    top.style.justifyContent =
      "space-between";

    top.style.gap =
      "16px";

    const heading =
      document.createElement(
        "div"
      );

    const subject =
      document.createElement(
        "strong"
      );

    subject.textContent =
      subjectNameById.get(
        task.subject_id
      ) ??
      task.subject_id ??
      "Невідомий суб’єкт";

    const source =
      document.createElement(
        "div"
      );

    source.className =
      "label";

    source.style.marginTop =
      "6px";

    source.textContent =
      manualReviewSourceLabel(
        task.source_path
      );

    heading.append(
      subject,
      source
    );

    const badge =
      document.createElement(
        "span"
      );

    badge.textContent =
      manualReviewStatusLabel(
        task.task_status
      );

    badge.style.padding =
      "6px 10px";

    badge.style.border =
      "1px solid #2a303b";

    badge.style.borderRadius =
      "999px";

    badge.style.fontSize =
      "13px";

    top.append(
      heading,
      badge
    );

    const ref =
      document.createElement(
        "div"
      );

    ref.className =
      "label";

    ref.style.marginTop =
      "14px";

    ref.style.wordBreak =
      "break-all";

    ref.textContent =
      `Ref: ${task.item_ref ?? "—"}`;

    const meta =
      document.createElement(
        "div"
      );

    meta.style.marginTop =
      "10px";

    meta.style.display =
      "grid";

    meta.style.gap =
      "6px";

    const occurrences =
      document.createElement(
        "div"
      );

    occurrences.textContent =
      `Snapshots: ${
        task.occurrence_count ?? 0
      }`;

    const latestVersion =
      document.createElement(
        "div"
      );

    latestVersion.className =
      "label";

    latestVersion.style.wordBreak =
      "break-all";

    latestVersion.textContent =
      task.latest_dossier_version_id
        ? `Остання версія досьє: ${
            task.latest_dossier_version_id
          }`
        : "Версію досьє не вказано";

    const updated =
      document.createElement(
        "div"
      );

    updated.className =
      "label";

    updated.textContent =
      task.updated_at
        ? `Оновлено: ${
            formatPortalDateTime(
              task.updated_at
            )
          }`
        : "Дата оновлення відсутня";

    meta.append(
      occurrences,
      latestVersion,
      updated
    );

    const actions =
      document.createElement(
        "div"
      );

    actions.style.display =
      "flex";

    actions.style.flexWrap =
      "wrap";

    actions.style.gap =
      "8px";

    actions.style.marginTop =
      "14px";

    const pending =
      manualReviewPendingTaskIds.has(
        task.id
      );

    const addAction = (
      label,
      taskStatus
    ) => {
      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.textContent =
        pending
          ? "Збереження…"
          : label;

      button.disabled =
        pending;

      button.style.padding =
        "9px 12px";

      button.style.borderRadius =
        "9px";

      button.style.border =
        "1px solid #2a303b";

      button.style.background =
        "#141821";

      button.style.color =
        "inherit";

      button.style.fontWeight =
        "700";

      button.style.cursor =
        pending
          ? "default"
          : "pointer";

      button.addEventListener(
        "click",
        () => {
          updateManualReviewTaskStatus(
            task.id,
            taskStatus
          );
        }
      );

      actions.append(
        button
      );
    };

    if (
      task.latest_dossier_version_id
    ) {
      const openSnapshot =
        document.createElement(
          "button"
        );

      openSnapshot.type =
        "button";

      openSnapshot.textContent =
        "Відкрити evidence snapshot";

      openSnapshot.disabled =
        dossierEvidenceLoading;

      openSnapshot.style.padding =
        "9px 12px";

      openSnapshot.style.borderRadius =
        "9px";

      openSnapshot.style.border =
        "1px solid #2a303b";

      openSnapshot.style.background =
        "#141821";

      openSnapshot.style.color =
        "inherit";

      openSnapshot.style.fontWeight =
        "700";

      openSnapshot.style.cursor =
        dossierEvidenceLoading
          ? "default"
          : "pointer";

      openSnapshot.addEventListener(
        "click",
        async () => {
          const subjectName =
            subjectNameById.get(
              task.subject_id
            ) ||
            task.subject_id;

          await loadDossierEvidence(
            task.subject_id,
            subjectName,
            task.latest_dossier_version_id
          );

          document
            .getElementById(
              "dossier-evidence-section"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
        }
      );

      actions.append(
        openSnapshot
      );
    }

    if (
      task.task_status ===
      "open"
    ) {
      addAction(
        "Вирішено",
        "resolved"
      );

      addAction(
        "Відхилити",
        "dismissed"
      );
    } else if (
      task.task_status ===
        "resolved" ||
      task.task_status ===
        "dismissed"
    ) {
      addAction(
        "Повернути у відкриті",
        "open"
      );
    }

    card.append(
      top,
      ref,
      meta,
      actions
    );

    container.append(
      card
    );
  }
}


async function updateManualReviewTaskStatus(
  taskId,
  taskStatus
) {
  if (
    !portalAuthenticated ||
    !taskId ||
    manualReviewPendingTaskIds.has(
      taskId
    )
  ) {
    return;
  }

  manualReviewPendingTaskIds.add(
    taskId
  );

  renderManualReviewQueue();

  const summary =
    document.getElementById(
      "manual-review-summary"
    );

  try {
    const response =
      await fetch(
        "/api/manual-review",
        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              taskId,
              taskStatus,
            }),
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {}

    if (
      response.status === 401
    ) {
      portalAuthenticated =
        false;

      manualReviewTasks = [];

      applyPortalAuthState();

      throw new Error(
        "Сесія завершилась. Увійдіть повторно."
      );
    }

    if (
      !response.ok ||
      data?.ok !== true
    ) {
      throw new Error(
        data?.error ??
        `HTTP ${response.status}`
      );
    }

    if (summary) {
      summary.textContent =
        "Статус оновлено.";
    }
  } catch (error) {
    console.error(
      "Manual review status update failed:",
      error
    );

    if (summary) {
      summary.textContent =
        error?.message ??
        "Не вдалося змінити статус.";
    }
  } finally {
    manualReviewPendingTaskIds.delete(
      taskId
    );

    renderManualReviewQueue();
  }

  if (portalAuthenticated) {
    await loadManualReviewQueue();
  }
}


async function loadManualReviewQueue() {
  if (
    !portalAuthenticated ||
    manualReviewLoading
  ) {
    return;
  }

  const statusSelect =
    document.getElementById(
      "manual-review-status-filter"
    );

  const subjectSelect =
    document.getElementById(
      "manual-review-subject-filter"
    );

  const params =
    new URLSearchParams();

  params.set(
    "taskStatus",
    statusSelect?.value ||
    "open"
  );

  if (
    subjectSelect?.value
  ) {
    params.set(
      "subjectId",
      subjectSelect.value
    );
  }

  params.set(
    "limit",
    "100"
  );

  manualReviewLoading = true;
  renderManualReviewQueue();

  try {
    const response =
      await fetch(
        `/api/manual-review?${params.toString()}`,
        {
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {}

    if (
      response.status === 401
    ) {
      portalAuthenticated =
        false;

      manualReviewTasks = [];

      applyPortalAuthState();

      throw new Error(
        "Сесія завершилась. Увійдіть повторно."
      );
    }

    if (
      !response.ok ||
      data?.ok !== true
    ) {
      throw new Error(
        data?.error ??
        `HTTP ${response.status}`
      );
    }

    manualReviewTasks =
      Array.isArray(
        data.tasks
      )
        ? data.tasks
        : [];
  } catch (error) {
    console.error(
      "Manual review loading failed:",
      error
    );

    manualReviewTasks = [];

    const container =
      document.getElementById(
        "manual-review-list"
      );

    if (container) {
      container.textContent =
        error?.message ??
        "Не вдалося завантажити Manual Review Queue.";
    }
  } finally {
    manualReviewLoading = false;
    renderManualReviewQueue();
  }
}


function applyPortalAuthState() {
  const loginCard =
    document.getElementById(
      "portal-login-card"
    );

  const sessionCard =
    document.getElementById(
      "portal-session-card"
    );

  const analystTools =
    document.getElementById(
      "analyst-tools"
    );

  const password =
    document.getElementById(
      "portal-password"
    );

  const submit =
    document.getElementById(
      "portal-login-submit"
    );

  if (loginCard) {
    loginCard.style.display =
      portalAuthenticated
        ? "none"
        : "block";
  }

  if (sessionCard) {
    sessionCard.style.display =
      portalAuthenticated
        ? "flex"
        : "none";
  }

  if (analystTools) {
    analystTools.style.display =
      portalAuthenticated
        ? "block"
        : "none";
  }

  if (password) {
    password.disabled =
      portalAuthPending;
  }

  if (submit) {
    submit.disabled =
      portalAuthPending;

    submit.textContent =
      portalAuthPending
        ? "Перевірка…"
        : "Увійти";
  }
}


async function loadPortalSession() {
  const status =
    document.getElementById(
      "portal-auth-status"
    );

  try {
    const response =
      await fetch(
        "/api/session",
        {
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    portalAuthenticated =
      data?.authenticated === true;

    if (
      portalAuthenticated
    ) {
      await loadManualReviewQueue();
    }

    if (status) {
      status.textContent =
        portalAuthenticated
          ? ""
          : "Для Manual Review потрібен вхід.";
    }
  } catch (error) {
    console.error(
      "Portal session check failed:",
      error
    );

    portalAuthenticated =
      false;

    if (status) {
      status.textContent =
        "Не вдалося перевірити сесію.";
    }
  }

  applyPortalAuthState();
}


async function submitPortalLogin(
  event
) {
  event.preventDefault();

  if (portalAuthPending) {
    return;
  }

  const password =
    document.getElementById(
      "portal-password"
    );

  const status =
    document.getElementById(
      "portal-auth-status"
    );

  const value =
    password?.value ?? "";

  if (!value) {
    if (status) {
      status.textContent =
        "Введіть пароль.";
    }

    return;
  }

  portalAuthPending = true;
  applyPortalAuthState();

  try {
    const response =
      await fetch(
        "/api/login",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              password:
                value,
            }),
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {}

    if (
      !response.ok ||
      data?.ok !== true
    ) {
      throw new Error(
        response.status === 401
          ? "Невірний пароль."
          : "Не вдалося виконати вхід."
      );
    }

    portalAuthenticated = true;

    await loadManualReviewQueue();

    if (password) {
      password.value = "";
    }

    if (status) {
      status.textContent = "";
    }
  } catch (error) {
    portalAuthenticated = false;

    if (status) {
      status.textContent =
        error?.message ??
        "Помилка авторизації.";
    }
  } finally {
    portalAuthPending = false;
    applyPortalAuthState();
  }
}


async function logoutPortal() {
  if (portalAuthPending) {
    return;
  }

  portalAuthPending = true;
  applyPortalAuthState();

  try {
    const response =
      await fetch(
        "/api/logout",
        {
          method:
            "POST",

          headers: {
            Accept:
              "application/json",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }
  } catch (error) {
    console.error(
      "Portal logout failed:",
      error
    );
  } finally {
    portalAuthenticated = false;
    portalAuthPending = false;
    manualReviewTasks = [];
    manualReviewPendingTaskIds.clear();
    activeDossierVersion = null;
    activeDossierRequestedVersionId = null;
    dossierEvidenceMessage = "";
    renderManualReviewQueue();
    renderDossierEvidence();
    applyPortalAuthState();
  }
}


async function loadHealth() {
  const status = document.getElementById("status");
  const dot = document.getElementById("dot");
  const subjects = document.getElementById("subjects");
  const mentions = document.getElementById("mentions");

  try {
    const response = await fetch("/api/health", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    subjects.textContent = String(data.subjects ?? 0);
    mentions.textContent = String(data.mentions ?? 0);
    status.textContent = "Сервіс працює";
    dot.classList.add("ok");
  } catch (error) {
    console.error("Health check failed:", error);
    status.textContent = "Сервіс недоступний";
    status.classList.add("error");
    dot.classList.remove("ok");
  }
}

function applyChatAvailability() {
  const input =
    document.getElementById(
      "subject-chat-input"
    );

  const status =
    document.getElementById(
      "subject-chat-status"
    );

  const button =
    document.getElementById(
      "subject-chat-submit"
    );

  const unavailable =
    chatApiAvailable === false;

  if (input) {
    input.disabled =
      unavailable;
  }

  if (button) {
    button.disabled =
      unavailable ||
      chatRequestPending;

    if (unavailable) {
      button.textContent =
        "Недоступно";
    } else if (
      !chatRequestPending
    ) {
      button.textContent =
        "Запитати";
    }
  }

  if (
    status &&
    unavailable
  ) {
    status.textContent =
      "AI-чат у цьому середовищі недоступний.";
  }
}

async function loadChatAvailability() {
  try {
    const response =
      await fetch(
        "/api/chat",
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",
          },
        }
      );

    const data =
      await response.json();

    chatApiAvailable =
      Boolean(
        response.ok &&
        data?.ok === true &&
        data?.available === true
      );
  } catch (error) {
    console.error(
      "Chat availability check failed:",
      error
    );

    chatApiAvailable =
      false;
  }

  applyChatAvailability();
}

function appendChatInlineMarkdown(
  container,
  value
) {
  const text =
    String(value ?? "");

  const pattern =
    /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;

  let lastIndex = 0;
  let match;

  while (
    (
      match =
        pattern.exec(text)
    ) !== null
  ) {
    if (
      match.index >
      lastIndex
    ) {
      container.append(
        document.createTextNode(
          text.slice(
            lastIndex,
            match.index
          )
        )
      );
    }

    if (match[2] != null) {
      const strong =
        document.createElement(
          "strong"
        );

      strong.textContent =
        match[2];

      container.append(
        strong
      );
    } else if (
      match[4] != null &&
      match[5] != null
    ) {
      const link =
        document.createElement(
          "a"
        );

      link.textContent =
        match[4];

      link.href =
        match[5];

      link.target =
        "_blank";

      link.rel =
        "noopener noreferrer";

      link.style.color =
        "inherit";

      link.style.textDecoration =
        "underline";

      container.append(
        link
      );
    }

    lastIndex =
      pattern.lastIndex;
  }

  if (
    lastIndex <
    text.length
  ) {
    container.append(
      document.createTextNode(
        text.slice(
          lastIndex
        )
      )
    );
  }
}

function renderChatMarkdown(
  container,
  value
) {
  container.replaceChildren();

  const lines =
    String(value ?? "")
      .split(/\r?\n/);

  let list = null;

  for (const line of lines) {
    const trimmed =
      line.trim();

    if (!trimmed) {
      list = null;

      const spacer =
        document.createElement(
          "div"
        );

      spacer.style.height =
        "8px";

      container.append(
        spacer
      );

      continue;
    }

    const heading =
      /^\s*#{1,3}\s+(.+)$/
        .exec(line);

    if (heading) {
      list = null;

      const title =
        document.createElement(
          "div"
        );

      title.style.fontWeight =
        "700";

      title.style.fontSize =
        "1.05em";

      title.style.marginTop =
        "6px";

      appendChatInlineMarkdown(
        title,
        heading[1]
      );

      container.append(
        title
      );

      continue;
    }

    const bullet =
      /^\s*[-*]\s+(.+)$/
        .exec(line);

    if (bullet) {
      if (!list) {
        list =
          document.createElement(
            "ul"
          );

        list.style.margin =
          "4px 0 4px 20px";

        list.style.padding =
          "0";

        container.append(
          list
        );
      }

      const item =
        document.createElement(
          "li"
        );

      item.style.margin =
        "4px 0";

      appendChatInlineMarkdown(
        item,
        bullet[1]
      );

      list.append(
        item
      );

      continue;
    }

    list = null;

    const paragraph =
      document.createElement(
        "div"
      );

    appendChatInlineMarkdown(
      paragraph,
      line
    );

    container.append(
      paragraph
    );
  }
}

function appendChatMessage(
  role,
  text
) {
  const container =
    document.getElementById(
      "subject-chat-messages"
    );

  if (!container) {
    return;
  }

  if (
    container.dataset.empty ===
    "true"
  ) {
    container.replaceChildren();
    delete container.dataset.empty;
  }

  const item =
    document.createElement("div");

  item.style.padding = "12px";
  item.style.borderRadius = "12px";
  item.style.border =
    "1px solid #252b36";

  item.style.background =
    role === "user"
      ? "#1b2230"
      : "#10141c";

  const label =
    document.createElement("div");

  label.className = "label";
  label.style.marginBottom = "6px";

  label.textContent =
    role === "user"
      ? "Ви"
      : "Person Monitor AI";

  const content =
    document.createElement("div");

  content.style.whiteSpace =
    "pre-wrap";

  content.style.wordBreak =
    "break-word";

  content.style.lineHeight =
    "1.55";

  if (role === "assistant") {
    renderChatMarkdown(
      content,
      text
    );
  } else {
    content.textContent =
      String(text ?? "");
  }

  item.append(
    label,
    content
  );

  container.append(item);

  container.scrollTop =
    container.scrollHeight;
}

function prepareSubjectChat(
  subjectId,
  fullName
) {
  activeChatSubjectId =
    subjectId;

  activeChatSubjectName =
    fullName ?? "";

  activeChatHistory = [];
  chatRequestPending = false;

  const section =
    document.getElementById(
      "subject-chat-section"
    );

  const title =
    document.getElementById(
      "subject-chat-title"
    );

  const messages =
    document.getElementById(
      "subject-chat-messages"
    );

  const input =
    document.getElementById(
      "subject-chat-input"
    );

  const status =
    document.getElementById(
      "subject-chat-status"
    );

  const button =
    document.getElementById(
      "subject-chat-submit"
    );

  if (section) {
    section.style.display =
      "block";
  }

  if (title) {
    title.textContent =
      `AI-аналіз: ${activeChatSubjectName}`;
  }

  if (messages) {
    messages.replaceChildren();

    const intro =
      document.createElement(
        "div"
      );

    intro.className = "label";

    intro.textContent =
      "Поставте питання про дані цього суб’єкта.";

    messages.append(intro);
    messages.dataset.empty =
      "true";
  }

  if (input) {
    input.value = "";
  }

  if (status) {
    status.textContent = "";
  }

  if (button) {
    button.disabled = false;
    button.textContent =
      "Запитати";
  }

  applyChatAvailability();
}

async function submitSubjectChat(
  event
) {
  event.preventDefault();

  if (chatRequestPending) {
    return;
  }

  if (
    chatApiAvailable === false
  ) {
    applyChatAvailability();
    return;
  }

  const input =
    document.getElementById(
      "subject-chat-input"
    );

  const status =
    document.getElementById(
      "subject-chat-status"
    );

  const button =
    document.getElementById(
      "subject-chat-submit"
    );

  const message =
    input?.value
      ?.trim() ??
    "";

  if (!activeChatSubjectId) {
    if (status) {
      status.textContent =
        "Спочатку оберіть суб’єкта.";
    }

    return;
  }

  if (!message) {
    return;
  }

  const requestHistory =
    activeChatHistory
      .slice(-10);

  appendChatMessage(
    "user",
    message
  );

  if (input) {
    input.value = "";
  }

  chatRequestPending = true;

  if (button) {
    button.disabled = true;
    button.textContent =
      "Аналізую…";
  }

  if (status) {
    status.textContent =
      "Локальна AI-модель формує відповідь…";
  }

  try {
    const response =
      await fetch(
        "/api/chat",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              subjectId:
                activeChatSubjectId,

              message,

              history:
                requestHistory,
            }),
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {}

    if (
      !response.ok ||
      data?.ok !== true
    ) {
      throw new Error(
        data?.error ??
        `HTTP ${response.status}`
      );
    }

    const answer =
      String(
        data.answer ?? ""
      ).trim();

    appendChatMessage(
      "assistant",
      answer ||
      "Модель не повернула текстової відповіді."
    );

    activeChatHistory.push(
      {
        role:
          "user",
        content:
          message,
      },
      {
        role:
          "assistant",
        content:
          answer,
      }
    );

    activeChatHistory =
      activeChatHistory
        .slice(-10);

    if (status) {
      status.textContent =
        data.model
          ? `Модель: ${data.model}`
          : "Готово";
    }
  } catch (error) {
    console.error(
      "Chat request failed:",
      error
    );

    appendChatMessage(
      "assistant",
      "Не вдалося отримати відповідь AI."
    );

    if (status) {
      status.textContent =
        `Помилка: ${
          error?.message ??
          "невідома помилка"
        }`;
    }
  } finally {
    chatRequestPending =
      false;

    if (button) {
      button.disabled =
        chatApiAvailable ===
        false;

      button.textContent =
        chatApiAvailable ===
        false
          ? "Недоступно"
          : "Запитати";
    }

    if (
      chatApiAvailable !==
      false
    ) {
      input?.focus();
    }
  }
}

async function loadSubjects() {
  const container = document.getElementById("subjects-list");

  try {
    const response = await fetch("/api/subjects", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    container.replaceChildren();

    subjectNameById.clear();

    for (
      const subject
      of data.subjects ?? []
    ) {
      if (subject?.id) {
        subjectNameById.set(
          subject.id,
          subject.full_name ??
          subject.id
        );
      }
    }

    populateManualReviewSubjectFilter();

    renderManualReviewQueue();

    for (const subject of data.subjects ?? []) {
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "16px";
      card.style.cursor = "pointer";

      const name = document.createElement("div");
      name.className = "value";
      name.style.fontSize = "22px";
      name.textContent = subject.full_name ?? "Без ПІБ";

      const organization = document.createElement("div");
      organization.className = "label";
      organization.style.marginTop = "12px";
      organization.textContent =
        subject.organization ?? "Організацію не вказано";

      const position = document.createElement("div");
      position.textContent =
        subject.position ?? "Посаду не вказано";

      const city = document.createElement("div");
      city.className = "label";
      city.style.marginTop = "8px";
      city.textContent = subject.city ?? "";

      const count = document.createElement("div");
      count.className = "label";
      count.style.marginTop = "10px";
      count.textContent = `Згадок: ${subject.mention_count ?? 0}`;

      card.append(name, organization, position, city, count);

      card.addEventListener("click", async () => {
        prepareSubjectChat(
          subject.id,
          subject.full_name
        );

        activeDossierSubjectId =
          subject.id;

        activeDossierSubjectName =
          subject.full_name ||
          subject.id;

        activeDossierVersion =
          null;

        activeDossierRequestedVersionId =
          null;

        dossierEvidenceMessage =
          "";

        renderDossierEvidence();

        await Promise.all([
          loadSubjectStats(subject.id, subject.full_name),
          loadMentions(subject.id, subject.full_name),
          loadSubjectGraph(subject.id, subject.full_name),
        ]);

        if (portalAuthenticated) {
          await loadDossierEvidence(
            subject.id,
            subject.full_name
          );
        }

        document
          .getElementById("subject-stats-section")
          .scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      });

      container.append(card);
    }
  } catch (error) {
    console.error("Subjects loading failed:", error);
    container.textContent = "Не вдалося завантажити суб’єктів.";
  }
}

function formatPortalDateTime(value) {
  if (!value) {
    return "Ще не перевірявся";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadSubjectStats(subjectId, fullName) {
  const section =
    document.getElementById("subject-stats-section");

  const title =
    document.getElementById("subject-stats-title");

  const lastChecked =
    document.getElementById("subject-last-checked");

  const scanned =
    document.getElementById("subject-scanned");

  const threshold =
    document.getElementById("subject-threshold");

  const confirmed =
    document.getElementById("subject-confirmed");

  const providers =
    document.getElementById("subject-provider-stats");

  section.style.display = "block";
  title.textContent = `Огляд: ${fullName}`;
  providers.textContent = "Завантаження...";

  try {
    const response = await fetch(
      `/api/subject-stats?subjectId=${encodeURIComponent(subjectId)}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    lastChecked.textContent =
      formatPortalDateTime(data.subject.last_checked_at);

    scanned.textContent =
      String(data.subject.last_scanned_count ?? 0);

    threshold.textContent =
      `${data.subject.match_threshold ?? 0}%`;

    confirmed.textContent =
      `${data.summary.confirmed ?? 0} із ${data.summary.mentions ?? 0}`;

    providers.replaceChildren();

    if (!data.providers?.length) {
      providers.textContent =
        "Збережених згадок поки немає.";
      return;
    }

    for (const item of data.providers) {
      const row = document.createElement("div");

      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.gap = "16px";
      row.style.padding = "10px 0";
      row.style.borderBottom = "1px solid #252b36";

      const name = document.createElement("span");
      name.textContent = providerLabel(item.provider);

      const value = document.createElement("strong");
      value.textContent =
        `${item.mentions} · підтверджено ${item.confirmed}`;

      row.append(name, value);
      providers.append(row);
    }
  } catch (error) {
    console.error("Subject statistics loading failed:", error);

    providers.textContent =
      "Не вдалося завантажити статистику.";
  }
}

function renderMentions() {
  const container = document.getElementById("mentions-list");
  const search = document
    .getElementById("mentions-search")
    .value.trim()
    .toLowerCase();

  const provider =
    document.getElementById("mentions-provider").value;

  const sort =
    document.getElementById("mentions-sort").value;

  const count =
    document.getElementById("mentions-count");

  const moreButton =
    document.getElementById("mentions-more");

  const filtered = activeMentions
    .filter((mention) => {
      const matchesProvider =
        !provider || mention.provider === provider;

      const haystack = [
        mention.title,
        mention.snippet,
        mention.source,
        providerLabel(mention.provider),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search || haystack.includes(search);

      return matchesProvider && matchesSearch;
    })
    .sort((a, b) => {
      if (sort === "oldest") {
        return (
          parseMentionTimestamp(a.published_at) -
          parseMentionTimestamp(b.published_at)
        );
      }

      if (sort === "score") {
        return (
          Number(b.match_score ?? 0) -
          Number(a.match_score ?? 0)
        );
      }

      return (
        parseMentionTimestamp(b.published_at) -
        parseMentionTimestamp(a.published_at)
      );
    });

  const visible = filtered.slice(0, visibleMentions);

  count.textContent =
    `Показано: ${visible.length} із ${filtered.length}` +
    (filtered.length !== activeMentions.length
      ? ` · Усього: ${activeMentions.length}`
      : "");

  container.replaceChildren();

  if (!filtered.length) {
    container.textContent = activeMentions.length
      ? "За вибраними параметрами нічого не знайдено."
      : "Згадок поки не знайдено.";

    moreButton.style.display = "none";
    return;
  }

  for (const mention of visible) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "16px";

    const source = document.createElement("div");
    source.className = "label";
    source.textContent =
      mention.source ||
      providerLabel(mention.provider);

    const link = document.createElement("a");

    const publicUrl =
      mention.provider === "nazk-declarations"
        ? mention.url.replace(
            "https://public-api.nazk.gov.ua/v2/documents/",
            "https://public.nazk.gov.ua/documents/"
          )
        : mention.url;

    link.href = publicUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent =
      mention.title || mention.url;
    link.style.color = "inherit";
    link.style.fontSize = "18px";
    link.style.fontWeight = "700";

    card.append(source, link);

    if (mention.snippet) {
      const snippet = document.createElement("div");
      snippet.style.marginTop = "12px";
      snippet.textContent = mention.snippet;
      card.append(snippet);
    }

    const meta = document.createElement("div");
    meta.className = "label";
    meta.style.marginTop = "12px";

    const parts = [];

    if (mention.match_score != null) {
      parts.push(`Збіг: ${mention.match_score}%`);
    }

    if (mention.published_at) {
      parts.push(
        `Дата: ${formatMentionDate(mention.published_at)}`
      );
    }

    meta.textContent = parts.join(" · ");
    card.append(meta);

    container.append(card);
  }

  moreButton.style.display =
    visible.length < filtered.length
      ? "block"
      : "none";
}

function resetMentionPage() {
  visibleMentions = PAGE_SIZE;
  renderMentions();
}

async function loadMentions(subjectId, fullName) {
  const section =
    document.getElementById("mentions-section");

  const title =
    document.getElementById("mentions-title");

  const container =
    document.getElementById("mentions-list");

  const search =
    document.getElementById("mentions-search");

  const providerSelect =
    document.getElementById("mentions-provider");

  const sortSelect =
    document.getElementById("mentions-sort");

  const moreButton =
    document.getElementById("mentions-more");

  const excelReport =
    document.getElementById("excel-report");

  const pdfReport =
    document.getElementById("pdf-report");

  excelReport.href =
    `/api/report-excel?subjectId=${encodeURIComponent(subjectId)}`;

  pdfReport.href =
    `/api/report-pdf?subjectId=${encodeURIComponent(subjectId)}`;

  excelReport.style.display = "inline-block";
  pdfReport.style.display = "inline-block";

  section.style.display = "block";
  title.textContent = `Згадки: ${fullName}`;
  container.textContent = "Завантаження...";

  search.value = "";
  sortSelect.value = "newest";
  visibleMentions = PAGE_SIZE;
  moreButton.style.display = "none";

  try {
    const response = await fetch(
      `/api/mentions?subjectId=${encodeURIComponent(subjectId)}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    activeMentions = data.mentions ?? [];

    const providers = [
      ...new Set(
        activeMentions
          .map((item) => item.provider)
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      providerLabel(a).localeCompare(
        providerLabel(b),
        "uk"
      )
    );

    providerSelect.replaceChildren();

    const allOption =
      document.createElement("option");

    allOption.value = "";
    allOption.textContent = "Усі джерела";
    providerSelect.append(allOption);

    for (const provider of providers) {
      const option =
        document.createElement("option");

      option.value = provider;
      option.textContent = providerLabel(provider);
      providerSelect.append(option);
    }

    renderMentions();

    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    console.error("Mentions loading failed:", error);
    activeMentions = [];
    container.textContent =
      "Не вдалося завантажити згадки.";
  }
}

document
  .getElementById("mentions-search")
  .addEventListener("input", resetMentionPage);

document
  .getElementById("mentions-provider")
  .addEventListener("change", resetMentionPage);

document
  .getElementById("mentions-sort")
  .addEventListener("change", resetMentionPage);

document
  .getElementById("mentions-more")
  .addEventListener("click", () => {
    visibleMentions += PAGE_SIZE;
    renderMentions();
  });


const GRAPH_NODE_COLORS = {
  person: "#60a5fa",
  asset: "#f59e0b",
  organization: "#34d399",
  person_observation: "#c084fc",
  organization_observation: "#fb7185",
};

let activeGraphSubjectId = null;
let activeGraphSubjectName = "";
let activeSubjectGraph = null;

const graphNodeOverrides = new Map();
let graphDragState = null;
let graphSuppressClickUntil = 0;

const GRAPH_LAYOUT_STORAGE_PREFIX =
  "person-monitor:graph-layout:v1";

function graphLayoutStorageKey(
  subjectId = activeGraphSubjectId,
  year = activeSubjectGraph?.year
) {
  if (!subjectId || year == null) {
    return null;
  }

  return (
    GRAPH_LAYOUT_STORAGE_PREFIX +
    ":" +
    String(subjectId) +
    ":" +
    String(year)
  );
}

function saveGraphNodeOverrides() {
  const key = graphLayoutStorageKey();

  if (!key) {
    return;
  }

  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        Object.fromEntries(
          graphNodeOverrides
        )
      )
    );
  } catch (error) {
    console.warn(
      "Graph layout save failed:",
      error
    );
  }
}

function loadGraphNodeOverrides(
  subjectId,
  year
) {
  graphNodeOverrides.clear();

  const key =
    graphLayoutStorageKey(
      subjectId,
      year
    );

  if (!key) {
    return;
  }

  try {
    const raw =
      localStorage.getItem(key);

    if (!raw) {
      return;
    }

    const saved = JSON.parse(raw);

    for (
      const [nodeId, point]
      of Object.entries(saved)
    ) {
      if (
        Number.isFinite(point?.x) &&
        Number.isFinite(point?.y)
      ) {
        graphNodeOverrides.set(
          nodeId,
          {
            x: point.x,
            y: point.y,
          }
        );
      }
    }
  } catch (error) {
    console.warn(
      "Graph layout load failed:",
      error
    );
  }
}

function graphNodeColor(type) {
  return GRAPH_NODE_COLORS[type] ?? "#94a3b8";
}

function graphVisibleData(graph, relationType) {
  const allNodes = graph.nodes ?? [];
  const allEdges = graph.edges ?? [];

  if (!relationType) {
    return {
      nodes: allNodes,
      edges: allEdges,
    };
  }

  let edges =
    allEdges.filter(
      (edge) =>
        edge.type === relationType
    );

  if (
    relationType ===
      "third_party_rightsholder"
  ) {
    const sourceIds =
      new Set(
        edges.map(
          (edge) =>
            String(edge.source)
        )
      );

    const pathEdges =
      allEdges.filter(
        (edge) =>
          sourceIds.has(
            String(edge.target)
          ) &&
          String(edge.source) ===
            String(
              graph.subject?.entity_id
            )
      );

    const seen =
      new Set(
        edges.map(
          (edge) =>
            String(edge.id)
        )
      );

    for (const edge of pathEdges) {
      if (
        !seen.has(
          String(edge.id)
        )
      ) {
        edges.push(edge);
      }
    }
  }

  const nodeIds =
    new Set([
      String(
        graph.subject?.entity_id ?? ""
      ),
    ]);

  for (const edge of edges) {
    nodeIds.add(
      String(edge.source)
    );
    nodeIds.add(
      String(edge.target)
    );
  }

  return {
    nodes:
      allNodes.filter(
        (node) =>
          nodeIds.has(
            String(node.id)
          )
      ),
    edges,
  };
}

function graphPointerPosition(svg, event) {
  const point = svg.createSVGPoint();

  point.x = event.clientX;
  point.y = event.clientY;

  const matrix = svg.getScreenCTM();

  if (!matrix) {
    return {
      x: 0,
      y: 0,
    };
  }

  const transformed =
    point.matrixTransform(
      matrix.inverse()
    );

  return {
    x: transformed.x,
    y: transformed.y,
  };
}

function graphNodeLayout(nodes, edges) {
  const width = 780;
  const rowHeight = 44;
  const nodeHeight = 30;
  const positions = new Map();
  const byDepth = new Map();

  for (const node of nodes) {
    const depth = Number(node.depth ?? 0);

    if (!byDepth.has(depth)) {
      byDepth.set(depth, []);
    }

    byDepth.get(depth).push(node);
  }

  const depthZero = byDepth.get(0) ?? [];
  const depthOne = byDepth.get(1) ?? [];
  const depthTwo = byDepth.get(2) ?? [];

  const maxRows = Math.max(
    depthOne.length,
    depthTwo.length,
    1
  );

  const height = Math.max(
    520,
    maxRows * rowHeight + 100
  );

  const columns = {
    0: {
      x: 24,
      width: 210,
    },
    1: {
      x: 280,
      width: 220,
    },
    2: {
      x: 550,
      width: 205,
    },
  };

  function placeColumn(items, depth) {
    if (!items.length) {
      return;
    }

    const column =
      columns[depth] ??
      columns[2];

    const totalSpan =
      (items.length - 1) *
      rowHeight;

    const startY =
      height / 2 -
      totalSpan / 2;

    items.forEach(
      (node, index) => {
        positions.set(
          String(node.id),
          {
            x: column.x,
            y:
              startY +
              index * rowHeight,
            width:
              column.width,
            height:
              nodeHeight,
          }
        );
      }
    );
  }

  const rootItems =
    [...depthZero];

  placeColumn(
    rootItems,
    0
  );

  const typePriority = {
    asset: 0,
    organization: 1,
    organization_observation: 2,
    person_observation: 3,
    person: 4,
  };

  const firstLevel =
    [...depthOne]
      .sort((a, b) => {
        const aPriority =
          typePriority[
            a.entity_type
          ] ?? 9;

        const bPriority =
          typePriority[
            b.entity_type
          ] ?? 9;

        if (
          aPriority !==
          bPriority
        ) {
          return (
            aPriority -
            bPriority
          );
        }

        return String(
          a.label ?? ""
        ).localeCompare(
          String(
            b.label ?? ""
          ),
          "uk"
        );
      });

  placeColumn(
    firstLevel,
    1
  );

  const secondLevel =
    [...depthTwo]
      .sort((a, b) => {
        function sourceScore(
          node
        ) {
          const sourceYs =
            edges
              .filter(
                (edge) =>
                  String(
                    edge.target
                  ) ===
                  String(
                    node.id
                  )
              )
              .map(
                (edge) =>
                  positions.get(
                    String(
                      edge.source
                    )
                  )?.y
              )
              .filter(
                Number.isFinite
              );

          if (
            !sourceYs.length
          ) {
            return (
              height / 2
            );
          }

          return (
            sourceYs.reduce(
              (sum, value) =>
                sum + value,
              0
            ) /
            sourceYs.length
          );
        }

        const scoreDiff =
          sourceScore(a) -
          sourceScore(b);

        if (
          Math.abs(
            scoreDiff
          ) > 0.5
        ) {
          return scoreDiff;
        }

        return String(
          a.label ?? ""
        ).localeCompare(
          String(
            b.label ?? ""
          ),
          "uk"
        );
      });

  placeColumn(
    secondLevel,
    2
  );

  for (
    const [depth, items]
    of byDepth
  ) {
    if (
      depth <= 2
    ) {
      continue;
    }

    placeColumn(
      items,
      depth
    );
  }

  for (
    const [nodeId, override]
    of graphNodeOverrides
  ) {
    const point =
      positions.get(nodeId);

    if (!point) {
      continue;
    }

    point.x = override.x;
    point.y = override.y;
  }

  return {
    positions,
    width,
    height,
    nodeHeight,
  };
}

function showGraphNodeDetails(node) {
  const container =
    document.getElementById(
      "subject-graph-details-content"
    );

  if (!container) {
    return;
  }

  container.replaceChildren();

  const title =
    document.createElement("div");

  title.style.fontSize = "20px";
  title.style.fontWeight = "700";
  title.textContent =
    node.label ?? "Без назви";

  const meta =
    document.createElement("div");

  meta.className = "label";
  meta.style.marginTop = "8px";
  meta.textContent =
    `${node.entity_type ?? "entity"}` +
    ` · depth ${node.depth ?? 0}`;

  container.append(
    title,
    meta
  );

  const entries =
    Object.entries(
      node.metadata ?? {}
    ).filter(
      ([, value]) =>
        value !== null &&
        value !== "" &&
        value !== undefined
    );

  for (
    const [key, value]
    of entries
  ) {
    const row =
      document.createElement("div");

    row.style.marginTop = "8px";

    const strong =
      document.createElement("strong");

    strong.textContent =
      `${key}: `;

    row.append(
      strong,
      document.createTextNode(
        typeof value === "object"
          ? JSON.stringify(value)
          : String(value)
      )
    );

    container.append(row);
  }
}

function renderSubjectGraph() {
  const svg =
    document.getElementById(
      "subject-graph"
    );

  const status =
    document.getElementById(
      "subject-graph-status"
    );

  const relationSelect =
    document.getElementById(
      "graph-relation"
    );

  if (
    !svg ||
    !status ||
    !activeSubjectGraph
  ) {
    return;
  }

  const relationType =
    relationSelect?.value ?? "";

  const {
    nodes,
    edges,
  } =
    graphVisibleData(
      activeSubjectGraph,
      relationType
    );

  svg.replaceChildren();

  const {
    positions,
    width,
    height,
  } =
    graphNodeLayout(
      nodes,
      edges
    );

  svg.setAttribute(
    "viewBox",
    `0 0 ${width} ${height}`
  );

  svg.style.minWidth =
    "700px";

  svg.style.touchAction = "none";
  svg.style.userSelect = "none";

  svg.onpointermove =
    (event) => {
      if (
        !graphDragState ||
        event.pointerId !==
          graphDragState.pointerId
      ) {
        return;
      }

      const current =
        graphPointerPosition(
          svg,
          event
        );

      const dx =
        current.x -
        graphDragState.startX;

      const dy =
        current.y -
        graphDragState.startY;

      if (
        Math.abs(dx) > 2 ||
        Math.abs(dy) > 2
      ) {
        graphSuppressClickUntil =
          Date.now() + 250;
      }

      const nextX =
        Math.max(
          0,
          Math.min(
            width -
              graphDragState.width,
            graphDragState.nodeX +
              dx
          )
        );

      const nextY =
        Math.max(
          48,
          Math.min(
            height - 24,
            graphDragState.nodeY +
              dy
          )
        );

      graphNodeOverrides.set(
        graphDragState.nodeId,
        {
          x: nextX,
          y: nextY,
        }
      );

      renderSubjectGraph();
    };

  svg.onpointerup =
    (event) => {
      if (
        !graphDragState ||
        event.pointerId !==
          graphDragState.pointerId
      ) {
        return;
      }

      try {
        svg.releasePointerCapture(
          event.pointerId
        );
      } catch {}

      saveGraphNodeOverrides();
      graphDragState = null;
    };

  svg.onpointercancel =
    () => {
      saveGraphNodeOverrides();
      graphDragState = null;
    };

  const namespace =
    "http://www.w3.org/2000/svg";

  const headings = [
    {
      x: 129,
      text: "Суб’єкт",
    },
    {
      x: 390,
      text:
        "Пов’язані об’єкти та особи",
    },
    {
      x: 652,
      text: "Треті сторони",
    },
  ];

  for (
    const heading
    of headings
  ) {
    const text =
      document.createElementNS(
        namespace,
        "text"
      );

    text.setAttribute(
      "x",
      heading.x
    );
    text.setAttribute(
      "y",
      "28"
    );
    text.setAttribute(
      "text-anchor",
      "middle"
    );
    text.setAttribute(
      "fill",
      "#64748b"
    );
    text.setAttribute(
      "font-size",
      "12"
    );
    text.setAttribute(
      "font-weight",
      "700"
    );
    text.textContent =
      heading.text;

    svg.append(text);
  }

  for (const edge of edges) {
    const source =
      positions.get(
        String(edge.source)
      );

    const target =
      positions.get(
        String(edge.target)
      );

    if (
      !source ||
      !target
    ) {
      continue;
    }

    const sourceX =
      source.x +
      source.width;

    const targetX =
      target.x;

    const horizontalGap =
      Math.max(
        40,
        (
          targetX -
          sourceX
        ) / 2
      );

    const path =
      document.createElementNS(
        namespace,
        "path"
      );

    path.setAttribute(
      "d",
      [
        `M ${sourceX} ${source.y}`,
        `C ${sourceX + horizontalGap} ${source.y},`,
        `${targetX - horizontalGap} ${target.y},`,
        `${targetX} ${target.y}`,
      ].join(" ")
    );

    path.setAttribute(
      "fill",
      "none"
    );
    path.setAttribute(
      "stroke",
      "#475569"
    );
    path.setAttribute(
      "stroke-width",
      "1.5"
    );
    path.setAttribute(
      "stroke-opacity",
      "0.72"
    );

    const title =
      document.createElementNS(
        namespace,
        "title"
      );

    title.textContent =
      edge.label ??
      edge.type ??
      "Зв’язок";

    path.append(title);
    svg.append(path);
  }

  for (const node of nodes) {
    const point =
      positions.get(
        String(node.id)
      );

    if (!point) {
      continue;
    }

    const group =
      document.createElementNS(
        namespace,
        "g"
      );

    group.style.cursor =
      "grab";

    group.addEventListener(
      "pointerdown",
      (event) => {
        if (
          event.button !== 0
        ) {
          return;
        }

        const start =
          graphPointerPosition(
            svg,
            event
          );

        graphDragState = {
          pointerId:
            event.pointerId,
          nodeId:
            String(node.id),
          startX:
            start.x,
          startY:
            start.y,
          nodeX:
            point.x,
          nodeY:
            point.y,
          width:
            point.width,
        };

        try {
          svg.setPointerCapture(
            event.pointerId
          );
        } catch {}

        event.preventDefault();
      }
    );

    const rect =
      document.createElementNS(
        namespace,
        "rect"
      );

    rect.setAttribute(
      "x",
      point.x
    );
    rect.setAttribute(
      "y",
      point.y -
        point.height / 2
    );
    rect.setAttribute(
      "width",
      point.width
    );
    rect.setAttribute(
      "height",
      point.height
    );
    rect.setAttribute(
      "rx",
      "9"
    );
    rect.setAttribute(
      "fill",
      "#111827"
    );
    rect.setAttribute(
      "stroke",
      graphNodeColor(
        node.entity_type
      )
    );
    rect.setAttribute(
      "stroke-width",
      Number(node.depth) === 0
        ? "2.5"
        : "1.5"
    );

    const dot =
      document.createElementNS(
        namespace,
        "circle"
      );

    dot.setAttribute(
      "cx",
      point.x + 14
    );
    dot.setAttribute(
      "cy",
      point.y
    );
    dot.setAttribute(
      "r",
      Number(node.depth) === 0
        ? "6"
        : "5"
    );
    dot.setAttribute(
      "fill",
      graphNodeColor(
        node.entity_type
      )
    );

    const text =
      document.createElementNS(
        namespace,
        "text"
      );

    text.setAttribute(
      "x",
      point.x + 27
    );
    text.setAttribute(
      "y",
      point.y + 4
    );
    text.setAttribute(
      "fill",
      "#e2e8f0"
    );
    text.setAttribute(
      "font-size",
      Number(node.depth) === 0
        ? "11.5"
        : "10.5"
    );
    text.setAttribute(
      "font-weight",
      Number(node.depth) === 0
        ? "700"
        : "500"
    );

    const label =
      String(
        node.label ??
        "Без назви"
      );

    const maxChars =
      Number(node.depth) === 0
        ? 27
        : 29;

    text.textContent =
      label.length >
        maxChars
        ? (
            label.slice(
              0,
              maxChars - 1
            ) + "…"
          )
        : label;

    const title =
      document.createElementNS(
        namespace,
        "title"
      );

    title.textContent =
      label;

    group.append(
      rect,
      dot,
      text,
      title
    );

    group.addEventListener(
      "click",
      () => {
        if (
          Date.now() <
          graphSuppressClickUntil
        ) {
          return;
        }

        showGraphNodeDetails(
          node
        );
      }
    );

    svg.append(group);
  }

  status.textContent =
    `Рік: ${activeSubjectGraph.year ?? "—"} · ` +
    `вузлів: ${nodes.length} · ` +
    `зв’язків: ${edges.length}`;
}

function populateGraphYears(graph) {
  const select =
    document.getElementById(
      "graph-year"
    );

  if (!select) {
    return;
  }

  select.replaceChildren();

  const years =
    graph.available_years ?? [];

  if (!years.length) {
    const option =
      document.createElement(
        "option"
      );

    option.value = "";
    option.textContent =
      "Немає даних";
    select.append(option);
    return;
  }

  for (const year of years) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(year);

    option.textContent =
      String(year);

    if (
      Number(year) ===
      Number(graph.year)
    ) {
      option.selected = true;
    }

    select.append(option);
  }
}

async function loadSubjectGraph(
  subjectId,
  fullName,
  year = null
) {
  const section =
    document.getElementById(
      "subject-graph-section"
    );

  const title =
    document.getElementById(
      "subject-graph-title"
    );

  const status =
    document.getElementById(
      "subject-graph-status"
    );

  if (
    !section ||
    !title ||
    !status
  ) {
    return;
  }

  activeGraphSubjectId =
    subjectId;

  activeGraphSubjectName =
    fullName ?? "";

  section.style.display =
    "block";

  title.textContent =
    `Граф зв’язків: ${fullName}`;

  status.textContent =
    "Завантаження...";

  const params =
    new URLSearchParams({
      subjectId,
    });

  if (year != null && year !== "") {
    params.set(
      "year",
      String(year)
    );
  }

  try {
    const response =
      await fetch(
        `/api/subject-graph?${params.toString()}`,
        {
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    activeSubjectGraph = data;

    loadGraphNodeOverrides(
      subjectId,
      data.year
    );

    graphDragState = null;

    populateGraphYears(data);

    const relationSelect =
      document.getElementById(
        "graph-relation"
      );

    if (relationSelect) {
      relationSelect.value = "";
    }

    const details =
      document.getElementById(
        "subject-graph-details-content"
      );

    if (details) {
      details.textContent =
        "Натисніть вузол";
    }

    renderSubjectGraph();
  } catch (error) {
    console.error(
      "Subject graph loading failed:",
      error
    );

    activeSubjectGraph = null;

    status.textContent =
      "Не вдалося завантажити граф.";
  }
}

document
  .getElementById("graph-year")
  ?.addEventListener(
    "change",
    (event) => {
      if (!activeGraphSubjectId) {
        return;
      }

      loadSubjectGraph(
        activeGraphSubjectId,
        activeGraphSubjectName,
        event.target.value
      );
    }
  );

document
  .getElementById("graph-relation")
  ?.addEventListener(
    "change",
    renderSubjectGraph
  );

document
  .getElementById(
    "graph-reset-layout"
  )
  ?.addEventListener(
    "click",
    () => {
      const key =
        graphLayoutStorageKey();

      if (key) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(
            "Graph layout reset failed:",
            error
          );
        }
      }

      graphNodeOverrides.clear();
      graphDragState = null;
      renderSubjectGraph();
    }
  );

document
  .getElementById(
    "subject-chat-form"
  )
  ?.addEventListener(
    "submit",
    submitSubjectChat
  );

document
  .getElementById(
    "subject-chat-input"
  )
  ?.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        (
          event.metaKey ||
          event.ctrlKey
        )
      ) {
        event.preventDefault();

        document
          .getElementById(
            "subject-chat-form"
          )
          ?.requestSubmit();
      }
    }
  );

document
  .getElementById(
    "manual-review-status-filter"
  )
  ?.addEventListener(
    "change",
    loadManualReviewQueue
  );

document
  .getElementById(
    "manual-review-subject-filter"
  )
  ?.addEventListener(
    "change",
    loadManualReviewQueue
  );

document
  .getElementById(
    "manual-review-refresh"
  )
  ?.addEventListener(
    "click",
    loadManualReviewQueue
  );

document
  .getElementById(
    "portal-login-form"
  )
  ?.addEventListener(
    "submit",
    submitPortalLogin
  );

document
  .getElementById(
    "portal-logout"
  )
  ?.addEventListener(
    "click",
    logoutPortal
  );

loadPortalSession();
document
  .getElementById(
    "dossier-evidence-refresh"
  )
  ?.addEventListener(
    "click",
    () => {
      if (
        activeDossierSubjectId
      ) {
        loadDossierEvidence(
          activeDossierSubjectId,
          activeDossierSubjectName,
          activeDossierRequestedVersionId
        );
      }
    }
  );

loadHealth();
loadChatAvailability();
loadSubjects();
