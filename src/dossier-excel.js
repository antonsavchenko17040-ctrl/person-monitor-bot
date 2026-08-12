import ExcelJS from "exceljs";

import {
  DOSSIER_EXPORT_MODEL_VERSION,
} from "./dossier-export-model.js";

export const DOSSIER_EXCEL_VERSION =
  "dossier-excel-v1";

export const DOSSIER_EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const COLORS = {
  navy:
    "17365D",

  blue:
    "2F75B5",

  paleBlue:
    "D9EAF7",

  paleGray:
    "F2F2F2",

  white:
    "FFFFFF",

  border:
    "D9E2F3",

  text:
    "1F1F1F",

  muted:
    "666666",
};

function isRecord(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function text(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

function list(value) {
  return Array.isArray(value)
    ? value
        .filter(
          (item) =>
            item !== null &&
            item !== undefined &&
            String(item).trim()
        )
        .map(String)
    : [];
}

function rows(value) {
  return Array.isArray(value)
    ? value.filter(isRecord)
    : [];
}

function yesNo(value) {
  if (value === true) {
    return "Так";
  }

  if (value === false) {
    return "Ні";
  }

  return "";
}

function currencySummary(value) {
  if (!isRecord(value)) {
    return "";
  }

  return Object.entries(value)
    .filter(
      ([currency, amount]) =>
        currency &&
        amount !== null &&
        amount !== undefined
    )
    .map(
      ([currency, amount]) =>
        `${currency}: ${amount}`
    )
    .join("; ");
}

function rightsSummary(value) {
  return rows(value)
    .map((right) =>
      [
        right.right_type,
        right.percentage !== null &&
        right.percentage !== undefined
          ? `${right.percentage}%`
          : null,
        right.ownership_percentage !== null &&
        right.ownership_percentage !== undefined
          ? `${right.ownership_percentage}%`
          : null,
        right.share,
      ]
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
    .join("; ");
}

function evidenceUrls(value) {
  return rows(value)
    .map(
      (item) =>
        item.url
    )
    .filter(Boolean)
    .join("\n");
}

function locationSummary(value) {
  if (!isRecord(value)) {
    return "";
  }

  return [
    value.country,
    value.region,
    value.district,
    value.city,
  ]
    .filter(Boolean)
    .join(", ");
}

function safeFilePart(value) {
  return String(
    value ??
    "dossier"
  )
    .normalize("NFKC")
    .replace(
      /[\\/:*?"<>|]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      70
    )
    .replaceAll(
      " ",
      "_"
    ) ||
    "dossier";
}

function safeDate(value) {
  if (!value) {
    return null;
  }

  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function requiredModel(model) {
  if (!isRecord(model)) {
    throw new TypeError(
      "dossier export model is required"
    );
  }

  if (
    model.contract_version !==
    DOSSIER_EXPORT_MODEL_VERSION
  ) {
    throw new Error(
      "unsupported dossier export model version"
    );
  }

  return model;
}

function setColumnWidth(
  sheet,
  index,
  width
) {
  const column =
    sheet.getColumn(index);

  column.width =
    Math.max(
      column.width ?? 0,
      width
    );
}

function styleCellBorder(cell) {
  const side = {
    style:
      "thin",

    color: {
      argb:
        COLORS.border,
    },
  };

  cell.border = {
    top:
      side,

    right:
      side,

    bottom:
      side,

    left:
      side,
  };
}

function addSheetTitle(
  sheet,
  title,
  subtitle = null
) {
  sheet.mergeCells(
    1,
    1,
    1,
    8
  );

  const titleCell =
    sheet.getCell(
      1,
      1
    );

  titleCell.value =
    title;

  titleCell.font = {
    bold:
      true,

    size:
      18,

    color: {
      argb:
        COLORS.white,
    },
  };

  titleCell.fill = {
    type:
      "pattern",

    pattern:
      "solid",

    fgColor: {
      argb:
        COLORS.navy,
    },
  };

  titleCell.alignment = {
    vertical:
      "middle",

    horizontal:
      "left",
  };

  sheet.getRow(1).height =
    30;

  if (subtitle) {
    sheet.mergeCells(
      2,
      1,
      2,
      8
    );

    const subtitleCell =
      sheet.getCell(
        2,
        1
      );

    subtitleCell.value =
      subtitle;

    subtitleCell.font = {
      italic:
        true,

      color: {
        argb:
          COLORS.muted,
      },
    };

    subtitleCell.alignment = {
      wrapText:
        true,
    };
  }

  sheet.views = [{
    state:
      "frozen",

    ySplit:
      subtitle
        ? 2
        : 1,
  }];

  sheet.properties.defaultRowHeight =
    18;

  sheet.pageSetup = {
    orientation:
      "landscape",

    fitToPage:
      true,

    fitToWidth:
      1,

    fitToHeight:
      0,

    margins: {
      left:
        0.35,

      right:
        0.35,

      top:
        0.5,

      bottom:
        0.5,

      header:
        0.2,

      footer:
        0.2,
    },
  };
}

function addSectionTable(
  sheet,
  title,
  columns,
  data
) {
  const startRow =
    (
      sheet.lastRow
        ?.number ??
      2
    ) +
    2;

  const columnCount =
    Math.max(
      columns.length,
      1
    );

  sheet.mergeCells(
    startRow,
    1,
    startRow,
    columnCount
  );

  const titleCell =
    sheet.getCell(
      startRow,
      1
    );

  titleCell.value =
    title;

  titleCell.font = {
    bold:
      true,

    color: {
      argb:
        COLORS.white,
    },
  };

  titleCell.fill = {
    type:
      "pattern",

    pattern:
      "solid",

    fgColor: {
      argb:
        COLORS.blue,
    },
  };

  titleCell.alignment = {
    vertical:
      "middle",
  };

  sheet.getRow(
    startRow
  ).height =
    23;

  const headerRow =
    sheet.getRow(
      startRow + 1
    );

  headerRow.values =
    columns.map(
      (column) =>
        column.header
    );

  headerRow.height =
    26;

  headerRow.eachCell(
    {
      includeEmpty:
        true,
    },
    (cell) => {
      cell.font = {
        bold:
          true,

        color: {
          argb:
            COLORS.navy,
        },
      };

      cell.fill = {
        type:
          "pattern",

        pattern:
          "solid",

        fgColor: {
          argb:
            COLORS.paleBlue,
        },
      };

      cell.alignment = {
        vertical:
          "middle",

        horizontal:
          "center",

        wrapText:
          true,
      };

      styleCellBorder(
        cell
      );
    }
  );

  columns.forEach(
    (column, index) =>
      setColumnWidth(
        sheet,
        index + 1,
        column.width ?? 18
      )
  );

  if (!data.length) {
    sheet.mergeCells(
      startRow + 2,
      1,
      startRow + 2,
      columnCount
    );

    const emptyCell =
      sheet.getCell(
        startRow + 2,
        1
      );

    emptyCell.value =
      "Немає даних";

    emptyCell.font = {
      italic:
        true,

      color: {
        argb:
          COLORS.muted,
      },
    };

    emptyCell.fill = {
      type:
        "pattern",

      pattern:
        "solid",

      fgColor: {
        argb:
          COLORS.paleGray,
      },
    };

    return;
  }

  for (const item of data) {
    const row =
      sheet.addRow(
        columns.map(
          (column) =>
            item[
              column.key
            ] ??
            ""
        )
      );

    row.alignment = {
      vertical:
        "top",

      wrapText:
        true,
    };

    columns.forEach(
      (
        column,
        index
      ) => {
        const cell =
          row.getCell(
            index + 1
          );

        if (
          column.numberFormat &&
          typeof cell.value ===
            "number"
        ) {
          cell.numFmt =
            column.numberFormat;
        }

        styleCellBorder(
          cell
        );
      }
    );
  }
}

function addKeyValueTable(
  sheet,
  title,
  entries
) {
  addSectionTable(
    sheet,
    title,
    [
      {
        header:
          "Поле",

        key:
          "label",

        width:
          30,
      },

      {
        header:
          "Значення",

        key:
          "value",

        width:
          70,
      },
    ],
    entries
      .filter(
        (entry) =>
          entry.value !==
            null &&
          entry.value !==
            undefined &&
          String(
            entry.value
          ).trim() !==
            ""
      )
  );
}

function overviewSheet(
  workbook,
  model
) {
  const sheet =
    workbook.addWorksheet(
      "Огляд"
    );

  addSheetTitle(
    sheet,
    "Аналітичне досьє",
    model.subject
      ?.full_name ??
      ""
  );

  addKeyValueTable(
    sheet,
    "Профіль",
    [
      {
        label:
          "ПІБ",

        value:
          model.subject
            ?.full_name,
      },

      {
        label:
          "Посада",

        value:
          model.subject
            ?.position,
      },

      {
        label:
          "Організація",

        value:
          model.subject
            ?.organization,
      },

      {
        label:
          "Місто",

        value:
          model.subject
            ?.city,
      },

      {
        label:
          "Статус",

        value:
          model.subject
            ?.status,
      },

      {
        label:
          "Період",

        value:
          [
            model.meta
              ?.period
              ?.from_year,
            model.meta
              ?.period
              ?.to_year,
          ]
            .filter(
              (value) =>
                value !==
                  null &&
                value !==
                  undefined
            )
            .join(
              " — "
            ),
      },

      {
        label:
          "Доступні роки",

        value:
          list(
            model.meta
              ?.available_years
          ).join(
            ", "
          ),
      },
    ]
  );

  addKeyValueTable(
    sheet,
    "Ідентифікація",
    [
      {
        label:
          "Статус",

        value:
          model.identity
            ?.resolution_status,
      },

      {
        label:
          "Бал",

        value:
          model.identity
            ?.score,
      },

      {
        label:
          "Hard match",

        value:
          yesNo(
            model.identity
              ?.hard_match
          ),
      },

      {
        label:
          "Потребує перевірки",

        value:
          yesNo(
            model.identity
              ?.review_required
          ),
      },

      {
        label:
          "Ідентифікатори",

        value:
          list(
            model.identity
              ?.identifiers
          ).join(
            "; "
          ),
      },

      {
        label:
          "Аліаси",

        value:
          list(
            model.identity
              ?.aliases
          ).join(
            "; "
          ),
      },

      {
        label:
          "Підстави",

        value:
          list(
            model.identity
              ?.reasons
          ).join(
            "; "
          ),
      },
    ]
  );

  addKeyValueTable(
    sheet,
    "Аудит snapshot",
    [
      {
        label:
          "Версія досьє",

        value:
          model.dossier
            ?.version_id,
      },

      {
        label:
          "Статус досьє",

        value:
          model.dossier
            ?.status,
      },

      {
        label:
          "Report schema",

        value:
          model.dossier
            ?.report_schema_version,
      },

      {
        label:
          "Report generated",

        value:
          model.dossier
            ?.report_generated_at,
      },

      {
        label:
          "Payload hash",

        value:
          model.dossier
            ?.payload_hash,
      },

      {
        label:
          "Hash algorithm",

        value:
          model.dossier
            ?.payload_hash_version,
      },

      {
        label:
          "Snapshot created",

        value:
          model.dossier
            ?.created_at,
      },

      {
        label:
          "Export contract",

        value:
          DOSSIER_EXCEL_VERSION,
      },
    ]
  );

  addSectionTable(
    sheet,
    "Декларації",
    [
      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Реєстр",

        key:
          "registry",

        width:
          18,
      },

      {
        header:
          "GUID",

        key:
          "guid",

        width:
          38,
      },

      {
        header:
          "Опубліковано",

        key:
          "published",

        width:
          22,
      },

      {
        header:
          "Canonical",

        key:
          "canonical",

        width:
          12,
      },

      {
        header:
          "Першоджерело",

        key:
          "url",

        width:
          55,
      },
    ],
    rows(
      model.declarations
        ?.items
    ).map(
      (item) => ({
        year:
          item.year,

        registry:
          item.registry,

        guid:
          item.document_guid,

        published:
          item.published_at,

        canonical:
          yesNo(
            item.canonical
          ),

        url:
          item.source_url ||
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  return sheet;
}

function findingsSheet(
  workbook,
  model
) {
  const sheet =
    workbook.addWorksheet(
      "Ключові сигнали"
    );

  addSheetTitle(
    sheet,
    "Ключові сигнали",
    `Статус: ${
      model
        .executive_summary
        ?.status ??
      ""
    }`
  );

  addSectionTable(
    sheet,
    "Executive summary",
    [
      {
        header:
          "Правило",

        key:
          "rule",

        width:
          34,
      },

      {
        header:
          "Домен",

        key:
          "domain",

        width:
          24,
      },

      {
        header:
          "Результат",

        key:
          "result",

        width:
          16,
      },

      {
        header:
          "Severity",

        key:
          "severity",

        width:
          14,
      },

      {
        header:
          "Score",

        key:
          "score",

        width:
          10,
      },

      {
        header:
          "Повідомлення",

        key:
          "message",

        width:
          58,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model
        .executive_summary
        ?.items
    ).map(
      (item) => ({
        rule:
          item.rule_code,

        domain:
          item.domain,

        result:
          item.result,

        severity:
          item.severity,

        score:
          item.score,

        message:
          item.message,

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  return sheet;
}

function careerRelationsSheet(
  workbook,
  model
) {
  const sheet =
    workbook.addWorksheet(
      "Кар’єра і зв’язки"
    );

  addSheetTitle(
    sheet,
    "Кар’єра та зв’язки"
  );

  addSectionTable(
    sheet,
    "Кар’єра",
    [
      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Організація",

        key:
          "organization",

        width:
          38,
      },

      {
        header:
          "Посада",

        key:
          "position",

        width:
          38,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.career
        ?.items
    ).map(
      (item) => ({
        year:
          item.year,

        organization:
          item.organization,

        position:
          item.position,

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  addSectionTable(
    sheet,
    "Зміни кар’єри",
    [
      {
        header:
          "Від",

        key:
          "from",

        width:
          10,
      },

      {
        header:
          "До",

        key:
          "to",

        width:
          10,
      },

      {
        header:
          "Організація змінилась",

        key:
          "organizationChanged",

        width:
          22,
      },

      {
        header:
          "Посада змінилась",

        key:
          "positionChanged",

        width:
          20,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.career
        ?.transitions
    ).map(
      (item) => ({
        from:
          item.from_year,

        to:
          item.to_year,

        organizationChanged:
          yesNo(
            item
              .organization_changed
          ),

        positionChanged:
          yesNo(
            item
              .position_changed
          ),

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  addSectionTable(
    sheet,
    "Пов’язані особи",
    [
      {
        header:
          "ПІБ",

        key:
          "name",

        width:
          34,
      },

      {
        header:
          "Тип зв’язку",

        key:
          "relation",

        width:
          24,
      },

      {
        header:
          "Роль",

        key:
          "role",

        width:
          18,
      },

      {
        header:
          "Стосунок",

        key:
          "relationship",

        width:
          24,
      },

      {
        header:
          "Роки",

        key:
          "years",

        width:
          18,
      },

      {
        header:
          "Identity status",

        key:
          "identity",

        width:
          20,
      },

      {
        header:
          "Review",

        key:
          "review",

        width:
          12,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.related_people
        ?.items
    ).map(
      (item) => ({
        name:
          item.full_name,

        relation:
          item.relation_type,

        role:
          item.role,

        relationship:
          item.relationship,

        years:
          list(
            item.years
          ).join(
            ", "
          ),

        identity:
          item.identity_status,

        review:
          yesNo(
            item.review_required
          ),

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  addSectionTable(
    sheet,
    "Зв’язки",
    [
      {
        header:
          "Тип",

        key:
          "type",

        width:
          24,
      },

      {
        header:
          "Scope",

        key:
          "scope",

        width:
          14,
      },

      {
        header:
          "Від",

        key:
          "from",

        width:
          32,
      },

      {
        header:
          "До",

        key:
          "to",

        width:
          32,
      },

      {
        header:
          "Label",

        key:
          "label",

        width:
          38,
      },

      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Confidence",

        key:
          "confidence",

        width:
          14,
      },

      {
        header:
          "Verification",

        key:
          "verification",

        width:
          18,
      },

      {
        header:
          "Джерело",

        key:
          "source",

        width:
          14,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.relations
        ?.items
    ).map(
      (item) => ({
        type:
          item.relation_type,

        scope:
          item.relation_scope,

        from:
          item.from_name,

        to:
          item.to_name,

        label:
          item.label,

        year:
          item.year,

        confidence:
          item.confidence,

        verification:
          item.verification_status,

        source:
          item.source,

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  return sheet;
}

function financesSheet(
  workbook,
  model
) {
  const sheet =
    workbook.addWorksheet(
      "Фінанси"
    );

  addSheetTitle(
    sheet,
    "Доходи та грошові активи"
  );

  addSectionTable(
    sheet,
    "Доходи за роками",
    [
      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Декларант, UAH",

        key:
          "declarant",

        width:
          20,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Сім’я, UAH",

        key:
          "family",

        width:
          20,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Домогосподарство, UAH",

        key:
          "household",

        width:
          24,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.income
        ?.yearly
    ).map(
      (item) => ({
        year:
          item.year,

        declarant:
          item.declarant_uah,

        family:
          item.family_uah,

        household:
          item.household_uah,

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  addSectionTable(
    sheet,
    "Джерела доходу",
    [
      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Отримувач",

        key:
          "recipient",

        width:
          30,
      },

      {
        header:
          "Роль",

        key:
          "role",

        width:
          16,
      },

      {
        header:
          "Тип доходу",

        key:
          "type",

        width:
          28,
      },

      {
        header:
          "Сума",

        key:
          "amount",

        width:
          18,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Валюта",

        key:
          "currency",

        width:
          12,
      },

      {
        header:
          "Джерело",

        key:
          "source",

        width:
          38,
      },

      {
        header:
          "ЄДРПОУ",

        key:
          "edrpou",

        width:
          16,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.income
        ?.sources
    ).map(
      (item) => ({
        year:
          item.year,

        recipient:
          item.recipient_name,

        role:
          item.recipient_role,

        type:
          item.income_type ||
          item.other_income_type,

        amount:
          item.amount,

        currency:
          item.currency,

        source:
          item.source,

        edrpou:
          item.source_details
            ?.edrpou,

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  const cashYears =
    rows(
      model.cash_assets
        ?.yearly
    );

  addSectionTable(
    sheet,
    "Грошові активи за роками",
    [
      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Декларант",

        key:
          "declarant",

        width:
          35,
      },

      {
        header:
          "Домогосподарство",

        key:
          "household",

        width:
          40,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    cashYears.map(
      (item) => ({
        year:
          item.year,

        declarant:
          currencySummary(
            item
              .declarant_by_currency
          ),

        household:
          currencySummary(
            item
              .household_by_currency
          ),

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  addSectionTable(
    sheet,
    "Грошові активи — деталі",
    [
      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Тип",

        key:
          "type",

        width:
          24,
      },

      {
        header:
          "Сума",

        key:
          "amount",

        width:
          18,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Валюта",

        key:
          "currency",

        width:
          12,
      },

      {
        header:
          "Організація",

        key:
          "organization",

        width:
          36,
      },

      {
        header:
          "Власник",

        key:
          "owner",

        width:
          30,
      },

      {
        header:
          "Права",

        key:
          "rights",

        width:
          36,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    cashYears.flatMap(
      (yearItem) =>
        rows(
          yearItem.items
        ).map(
          (item) => ({
            year:
              yearItem.year,

            type:
              item.asset_type ||
              item.other_asset_type,

            amount:
              item.amount,

            currency:
              item.currency,

            organization:
              item.organization_name,

            owner:
              item.owner_name,

            rights:
              rightsSummary(
                item.rights
              ),

            evidence:
              evidenceUrls(
                item.evidence
              ),
          })
        )
    )
  );

  return sheet;
}

function assetsSheet(
  workbook,
  model
) {
  const sheet =
    workbook.addWorksheet(
      "Активи"
    );

  addSheetTitle(
    sheet,
    "Нерухомість та транспорт"
  );

  addSectionTable(
    sheet,
    "Нерухомість",
    [
      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Тип",

        key:
          "type",

        width:
          26,
      },

      {
        header:
          "Площа",

        key:
          "area",

        width:
          14,
      },

      {
        header:
          "Локація",

        key:
          "location",

        width:
          38,
      },

      {
        header:
          "Дата набуття",

        key:
          "acquired",

        width:
          18,
      },

      {
        header:
          "Вартість",

        key:
          "cost",

        width:
          18,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Власник",

        key:
          "owner",

        width:
          30,
      },

      {
        header:
          "Права",

        key:
          "rights",

        width:
          36,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.real_estate
        ?.yearly
    ).flatMap(
      (yearItem) =>
        rows(
          yearItem.items
        ).map(
          (item) => ({
            year:
              yearItem.year,

            type:
              item.object_type ||
              item.other_object_type,

            area:
              [
                item.area,
                item.area_unit,
              ]
                .filter(
                  (value) =>
                    value !==
                      null &&
                    value !==
                      undefined &&
                    value !==
                      ""
                )
                .join(
                  " "
                ),

            location:
              locationSummary(
                item.location
              ),

            acquired:
              item.acquisition_date,

            cost:
              item.cost,

            owner:
              item.owner_name,

            rights:
              rightsSummary(
                item.rights
              ),

            evidence:
              evidenceUrls(
                item.evidence
              ),
          })
        )
    )
  );

  addSectionTable(
    sheet,
    "Транспорт",
    [
      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Тип",

        key:
          "type",

        width:
          22,
      },

      {
        header:
          "Марка",

        key:
          "brand",

        width:
          20,
      },

      {
        header:
          "Модель",

        key:
          "model",

        width:
          24,
      },

      {
        header:
          "Рік випуску",

        key:
          "productionYear",

        width:
          14,
      },

      {
        header:
          "Дата набуття",

        key:
          "acquired",

        width:
          18,
      },

      {
        header:
          "Вартість",

        key:
          "cost",

        width:
          18,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Власник",

        key:
          "owner",

        width:
          30,
      },

      {
        header:
          "Права",

        key:
          "rights",

        width:
          36,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.vehicles
        ?.yearly
    ).flatMap(
      (yearItem) =>
        rows(
          yearItem.items
        ).map(
          (item) => ({
            year:
              yearItem.year,

            type:
              item.object_type ||
              item.other_object_type,

            brand:
              item.brand,

            model:
              item.model,

            productionYear:
              item.production_year,

            acquired:
              item.acquisition_date,

            cost:
              item.cost,

            owner:
              item.owner_name,

            rights:
              rightsSummary(
                item.rights
              ),

            evidence:
              evidenceUrls(
                item.evidence
              ),
          })
        )
    )
  );

  return sheet;
}

function analyticsSheet(
  workbook,
  model
) {
  const sheet =
    workbook.addWorksheet(
      "Аналітика"
    );

  addSheetTitle(
    sheet,
    "Аналітика та зміни"
  );

  addSectionTable(
    sheet,
    "Метрики",
    [
      {
        header:
          "Рік",

        key:
          "year",

        width:
          10,
      },

      {
        header:
          "Дохід декларанта",

        key:
          "income",

        width:
          20,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Дохід домогосподарства",

        key:
          "householdIncome",

        width:
          24,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Гроші декларанта",

        key:
          "cash",

        width:
          34,
      },

      {
        header:
          "Нерухомість",

        key:
          "realEstate",

        width:
          14,
      },

      {
        header:
          "Транспорт",

        key:
          "vehicles",

        width:
          14,
      },

      {
        header:
          "Зв’язки",

        key:
          "relations",

        width:
          12,
      },

      {
        header:
          "Кар’єра",

        key:
          "career",

        width:
          45,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.analytics
        ?.metrics
    ).map(
      (item) => ({
        year:
          item.year,

        income:
          item
            .income_declarant_uah,

        householdIncome:
          item
            .income_household_uah,

        cash:
          currencySummary(
            item
              .cash_declarant_by_currency
          ),

        realEstate:
          item.real_estate_items,

        vehicles:
          item.vehicle_items,

        relations:
          item.relation_count,

        career:
          [
            item.career
              ?.organization,
            item.career
              ?.position,
          ]
            .filter(Boolean)
            .join(
              " — "
            ),

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  addSectionTable(
    sheet,
    "Переходи",
    [
      {
        header:
          "Від",

        key:
          "from",

        width:
          10,
      },

      {
        header:
          "До",

        key:
          "to",

        width:
          10,
      },

      {
        header:
          "Δ доходу",

        key:
          "incomeDelta",

        width:
          18,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Δ доходу, %",

        key:
          "incomePercent",

        width:
          16,

        numberFormat:
          "0.00",
      },

      {
        header:
          "Δ cash UAH",

        key:
          "cashDelta",

        width:
          18,

        numberFormat:
          "#,##0.00",
      },

      {
        header:
          "Δ нерухомості",

        key:
          "realEstate",

        width:
          16,
      },

      {
        header:
          "Δ транспорту",

        key:
          "vehicles",

        width:
          16,
      },

      {
        header:
          "Організація змінилась",

        key:
          "organization",

        width:
          22,
      },

      {
        header:
          "Посада змінилась",

        key:
          "position",

        width:
          20,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.analytics
        ?.transitions
    ).map(
      (item) => ({
        from:
          item.from_year,

        to:
          item.to_year,

        incomeDelta:
          item.income_delta_uah,

        incomePercent:
          item
            .income_delta_percent,

        cashDelta:
          item.cash_uah_delta,

        realEstate:
          item
            .real_estate_count_delta,

        vehicles:
          item
            .vehicle_count_delta,

        organization:
          yesNo(
            item
              .organization_changed
          ),

        position:
          yesNo(
            item.position_changed
          ),

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  addSectionTable(
    sheet,
    "Аналітичні сигнали",
    [
      {
        header:
          "Правило",

        key:
          "rule",

        width:
          34,
      },

      {
        header:
          "Домен",

        key:
          "domain",

        width:
          24,
      },

      {
        header:
          "Результат",

        key:
          "result",

        width:
          16,
      },

      {
        header:
          "Severity",

        key:
          "severity",

        width:
          14,
      },

      {
        header:
          "Score",

        key:
          "score",

        width:
          10,
      },

      {
        header:
          "Повідомлення",

        key:
          "message",

        width:
          58,
      },

      {
        header:
          "Evidence",

        key:
          "evidence",

        width:
          55,
      },
    ],
    rows(
      model.analytics
        ?.findings
    ).map(
      (item) => ({
        rule:
          item.rule_code,

        domain:
          item.domain,

        result:
          item.result,

        severity:
          item.severity,

        score:
          item.score,

        message:
          item.message,

        evidence:
          evidenceUrls(
            item.evidence
          ),
      })
    )
  );

  return sheet;
}

function mentionsSheet(
  workbook,
  model
) {
  const sheet =
    workbook.addWorksheet(
      "Згадки"
    );

  addSheetTitle(
    sheet,
    "Релевантні згадки",
    `Усього: ${
      model.mentions
        ?.total ??
      0
    }`
  );

  addSectionTable(
    sheet,
    "Media / Web",
    [
      {
        header:
          "Провайдер",

        key:
          "provider",

        width:
          22,
      },

      {
        header:
          "Джерело",

        key:
          "source",

        width:
          28,
      },

      {
        header:
          "Дата",

        key:
          "published",

        width:
          20,
      },

      {
        header:
          "Заголовок",

        key:
          "title",

        width:
          48,
      },

      {
        header:
          "Фрагмент",

        key:
          "snippet",

        width:
          65,
      },

      {
        header:
          "Match",

        key:
          "level",

        width:
          14,
      },

      {
        header:
          "Score",

        key:
          "score",

        width:
          10,
      },

      {
        header:
          "Підстави",

        key:
          "reasons",

        width:
          42,
      },

      {
        header:
          "URL",

        key:
          "url",

        width:
          55,
      },
    ],
    rows(
      model.mentions
        ?.items
    ).map(
      (item) => ({
        provider:
          item.provider,

        source:
          item.source,

        published:
          item.published_at,

        title:
          item.title,

        snippet:
          item.snippet,

        level:
          item.match_level,

        score:
          item.match_score,

        reasons:
          list(
            item.reasons
          ).join(
            "; "
          ),

        url:
          item.url,
      })
    )
  );

  return sheet;
}

function sourcesSheet(
  workbook,
  model
) {
  const sheet =
    workbook.addWorksheet(
      "Джерела"
    );

  addSheetTitle(
    sheet,
    "Каталог першоджерел"
  );

  addSectionTable(
    sheet,
    "Canonical source catalog",
    [
      {
        header:
          "Тип",

        key:
          "type",

        width:
          22,
      },

      {
        header:
          "Провайдер",

        key:
          "provider",

        width:
          24,
      },

      {
        header:
          "Назва",

        key:
          "title",

        width:
          52,
      },

      {
        header:
          "Опубліковано",

        key:
          "published",

        width:
          22,
      },

      {
        header:
          "Зафіксовано",

        key:
          "observed",

        width:
          22,
      },

      {
        header:
          "URL",

        key:
          "url",

        width:
          60,
      },
    ],
    rows(
      model.sources
    ).map(
      (item) => ({
        type:
          item.source_type,

        provider:
          item.provider,

        title:
          item.title,

        published:
          item.published_at,

        observed:
          item.observed_at,

        url:
          item.url,
      })
    )
  );

  return sheet;
}

function methodologySheet(
  workbook,
  model
) {
  const sheet =
    workbook.addWorksheet(
      "Методологія"
    );

  addSheetTitle(
    sheet,
    "Методологія"
  );

  addKeyValueTable(
    sheet,
    "Версії",
    [
      {
        label:
          "Report model",

        value:
          model.methodology
            ?.report_model_version,
      },

      {
        label:
          "Analytics",

        value:
          model.methodology
            ?.analytics_version,
      },

      {
        label:
          "Rules",

        value:
          model.methodology
            ?.rules_version,
      },

      {
        label:
          "Analytical brief",

        value:
          model.methodology
            ?.analytical_brief_version,
      },

      {
        label:
          "Evidence policy",

        value:
          model.methodology
            ?.evidence_policy_version,
      },

      {
        label:
          "Manual review manifest",

        value:
          model.methodology
            ?.manual_review_manifest_version,
      },
    ]
  );

  addSectionTable(
    sheet,
    "Примітки",
    [
      {
        header:
          "Текст",

        key:
          "text",

        width:
          100,
      },
    ],
    list(
      model.methodology
        ?.notes
    ).map(
      (item) => ({
        text:
          item,
      })
    )
  );

  addSectionTable(
    sheet,
    "Обмеження",
    [
      {
        header:
          "Текст",

        key:
          "text",

        width:
          100,
      },
    ],
    list(
      model.methodology
        ?.limitations
    ).map(
      (item) => ({
        text:
          item,
      })
    )
  );

  return sheet;
}

export async function buildDossierExcel(
  inputModel
) {
  const model =
    requiredModel(
      inputModel
    );

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Person Monitor";

  workbook.lastModifiedBy =
    "Person Monitor";

  const workbookDate =
    safeDate(
      model.dossier
        ?.report_generated_at
    ) ??
    safeDate(
      model.dossier
        ?.created_at
    ) ??
    new Date(0);

  workbook.created =
    workbookDate;

  workbook.modified =
    workbookDate;

  workbook.subject =
    "Canonical analytical dossier export";

  workbook.title =
    `Аналітичне досьє: ${
      model.subject
        ?.full_name ??
      ""
    }`;

  workbook.company =
    "Person Monitor";

  overviewSheet(
    workbook,
    model
  );

  findingsSheet(
    workbook,
    model
  );

  careerRelationsSheet(
    workbook,
    model
  );

  financesSheet(
    workbook,
    model
  );

  assetsSheet(
    workbook,
    model
  );

  analyticsSheet(
    workbook,
    model
  );

  mentionsSheet(
    workbook,
    model
  );

  sourcesSheet(
    workbook,
    model
  );

  methodologySheet(
    workbook,
    model
  );

  const buffer =
    Buffer.from(
      await workbook.xlsx
        .writeBuffer()
    );

  const versionPart =
    safeFilePart(
      model.dossier
        ?.version_id ??
      "snapshot"
    ).slice(
      0,
      12
    );

  return {
    version:
      DOSSIER_EXCEL_VERSION,

    contentType:
      DOSSIER_EXCEL_CONTENT_TYPE,

    filename:
      `${safeFilePart(
        model.subject
          ?.full_name
      )}_dossier_${versionPart}.xlsx`,

    buffer,
  };
}
