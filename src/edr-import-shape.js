import { createHash } from "node:crypto";

const RECORD_TYPES = new Set([
  "organization",
  "fop",
]);

const TEXT_RELATIONS = [
  ["founders", "founder"],
  ["beneficiaries", "beneficiary"],
  ["signers", "signer"],
  ["members", "member"],
];

function requiredText(value, field) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new TypeError(`${field} is required`);
  }

  return text;
}

function requiredSequence(value) {
  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    throw new TypeError(
      "sourceSequence must be a non-negative safe integer",
    );
  }

  return number;
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableValue(
          value[key],
        );
        return result;
      }, {});
  }

  return value;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) =>
        item != null &&
        item !== "",
    ),
  );
}

function relation({
  sourceSequence,
  relationType,
  ordinal,
  valueText = null,
  valueCode = null,
  metadata = {},
}) {
  const text =
    valueText == null
      ? null
      : String(valueText).trim() ||
        null;

  const code =
    valueCode == null
      ? null
      : String(valueCode).trim() ||
        null;

  if (!text && !code) {
    return null;
  }

  return {
    source_sequence:
      sourceSequence,
    relation_type:
      relationType,
    ordinal,
    value_text:
      text,
    normalized_value:
      normalizeEdrLookupText(text),
    value_code:
      code,
    metadata:
      compactObject(metadata),
  };
}

export function normalizeEdrLookupText(
  value,
) {
  if (value == null) {
    return null;
  }

  const text = String(value)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return text || null;
}

export function stableEdrJson(value) {
  return JSON.stringify(
    stableValue(value),
  );
}

export function buildEdrContentHash(
  record,
) {
  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record)
  ) {
    throw new TypeError(
      "record must be an object",
    );
  }

  return createHash("sha256")
    .update(stableEdrJson(record))
    .digest("hex");
}

export function buildEdrImportRow(
  record,
  {
    sourceSequence,
  } = {},
) {
  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record)
  ) {
    throw new TypeError(
      "record must be an object",
    );
  }

  const recordType =
    requiredText(
      record.record_type,
      "record.record_type",
    );

  if (!RECORD_TYPES.has(recordType)) {
    throw new TypeError(
      "Unsupported EDR record type",
    );
  }

  return {
    source_sequence:
      requiredSequence(
        sourceSequence,
      ),
    record_type:
      recordType,
    record_number:
      requiredText(
        record.record_number,
        "record.record_number",
      ),
    name:
      record.name ?? null,
    normalized_name:
      normalizeEdrLookupText(
        record.name,
      ),
    short_name:
      record.short_name ?? null,
    edrpou:
      record.edrpou ?? null,
    status:
      record.status ?? null,
    legal_form:
      record.legal_form ?? null,
    registration:
      record.registration ?? null,
    farmer:
      record.farmer ?? null,
    estate_manager:
      record.estate_manager ?? null,
    content_hash:
      buildEdrContentHash(record),
    details:
      compactObject({
        schema_version:
          record.schema_version,
        founding_document_number:
          record.founding_document_number,
        purpose:
          record.purpose,
        authorized_capital:
          record.authorized_capital,
        statute:
          record.statute,
        managing_paper:
          record.managing_paper,
        termination_started:
          record.termination_started,
        bankruptcy_readjustment:
          record.bankruptcy_readjustment,
        terminated_info:
          record.terminated_info,
        termination_cancel_info:
          record.termination_cancel_info,
        exchange_answers:
          record.exchange_answers,
      }),
  };
}

export function
buildEdrRelationRows(
  record,
  {
    sourceSequence,
  } = {},
) {
  const sequence =
    requiredSequence(
      sourceSequence,
    );

  const rows = [];

  for (
    const [
      field,
      relationType,
    ] of TEXT_RELATIONS
  ) {
    const values =
      Array.isArray(record?.[field])
        ? record[field]
        : [];

    values.forEach(
      (value, ordinal) => {
        const row = relation({
          sourceSequence:
            sequence,
          relationType,
          ordinal,
          valueText:
            value,
        });

        if (row) {
          rows.push(row);
        }
      },
    );
  }

  const singleRelations = [
    [
      "executive_power",
      record?.executive_power?.name,
      record?.executive_power?.code,
    ],
    [
      "superior_management",
      record?.superior_management,
      null,
    ],
  ];

  singleRelations.forEach(
    ([
      relationType,
      valueText,
      valueCode,
    ]) => {
      const row = relation({
        sourceSequence:
          sequence,
        relationType,
        ordinal: 0,
        valueText,
        valueCode,
      });

      if (row) {
        rows.push(row);
      }
    },
  );

  const objectRelations = [
    [
      "branches",
      "branch",
    ],
    [
      "predecessors",
      "predecessor",
    ],
    [
      "assignees",
      "assignee",
    ],
  ];

  for (
    const [
      field,
      relationType,
    ] of objectRelations
  ) {
    const values =
      Array.isArray(record?.[field])
        ? record[field]
        : [];

    values.forEach(
      (item, ordinal) => {
        const row = relation({
          sourceSequence:
            sequence,
          relationType,
          ordinal,
          valueText:
            item?.name,
          valueCode:
            item?.code,
          metadata:
            relationType === "branch"
              ? {
                  signer:
                    item?.signer,
                  create_date:
                    item?.create_date,
                  exchange_answers:
                    item?.exchange_answers,
                }
              : {},
        });

        if (row) {
          rows.push(row);
        }
      },
    );
  }

  return rows;
}
