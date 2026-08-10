export const EDR_NORMALIZED_SCHEMA_VERSION =
  "edr-normalized-v1";

export const EDR_RECORD_TYPES =
  Object.freeze({
    ORGANIZATION:
      "organization",

    FOP:
      "fop",
  });

function normalizeText(
  value,
) {
  if (
    value == null
  ) {
    return null;
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    for (
      const item of value
    ) {
      const normalized =
        normalizeText(
          item,
        );

      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  if (
    typeof value ===
      "object"
  ) {
    if (
      "_text" in value
    ) {
      return normalizeText(
        value._text,
      );
    }

    return null;
  }

  const normalized =
    String(value).trim();

  return (
    normalized ||
    null
  );
}

function normalizeCompactText(
  value,
) {
  const normalized =
    normalizeText(
      value,
    );

  if (!normalized) {
    return null;
  }

  return normalized.replace(
    /\s+/g,
    "",
  );
}

function toArray(
  value,
) {
  if (
    value == null
  ) {
    return [];
  }

  return (
    Array.isArray(value)
      ? value
      : [value]
  );
}

function normalizeStringList(
  container,
  key,
) {
  if (
    !container ||
    typeof container !==
      "object"
  ) {
    return [];
  }

  return toArray(
    container[key],
  )
    .map(
      normalizeText,
    )
    .filter(Boolean);
}

function hasObjectValue(
  value,
) {
  return Object.values(
    value,
  ).some(
    (item) =>
      item != null &&
      item !== "",
  );
}

function normalizeExecutivePower(
  value,
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  const result = {
    name:
      normalizeText(
        value.NAME,
      ),

    code:
      normalizeText(
        value.CODE,
      ),
  };

  return (
    hasObjectValue(result)
      ? result
      : null
  );
}

function normalizeBranches(
  value,
) {
  return toArray(
    value?.BRANCH,
  )
    .map(
      (branch) => ({
        code:
          normalizeText(
            branch?.CODE,
          ),

        name:
          normalizeText(
            branch?.NAME,
          ),

        signer:
          normalizeText(
            branch?.SIGNER,
          ),

        create_date:
          normalizeText(
            branch?.CREATE_DATE,
          ),

        exchange_answers:
          normalizeExchangeAnswers(
            branch?.EXCHANGE_DATA,
          ),
      }),
    )
    .filter(
      hasObjectValue,
    );
}

function normalizeTerminationStarted(
  value,
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  const result = {
    operation_date:
      normalizeText(
        value.OP_DATE,
      ),

    reason:
      normalizeText(
        value.REASON,
      ),

    subject_state:
      normalizeText(
        value.SBJ_STATE,
      ),

    signer_name:
      normalizeText(
        value.SIGNER_NAME,
      ),

    creditor_requirements_end_date:
      normalizeText(
        value.CREDITOR_REQ_END_DATE,
      ),
  };

  return (
    hasObjectValue(result)
      ? result
      : null
  );
}

function normalizeBankruptcy(
  value,
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  const result = {
    operation_date:
      normalizeText(
        value.OP_DATE,
      ),

    reason:
      normalizeText(
        value.REASON,
      ),

    subject_state:
      normalizeText(
        value.SBJ_STATE,
      ),

    head_name:
      normalizeText(
        value.BANKRUPTCY_READJUSTMENT_HEAD_NAME,
      ),
  };

  return (
    hasObjectValue(result)
      ? result
      : null
  );
}

function normalizeOrganizationLinks(
  value,
  itemKey,
) {
  return toArray(
    value?.[itemKey],
  )
    .map(
      (item) => ({
        name:
          normalizeText(
            item?.NAME,
          ),

        code:
          normalizeText(
            item?.CODE,
          ),
      }),
    )
    .filter(
      hasObjectValue,
    );
}

function normalizeExchangeAnswers(
  value,
) {
  return toArray(
    value?.EXCHANGE_ANSWER,
  )
    .map(
      (answer) => ({
        tax_payer_type:
          normalizeText(
            answer?.TAX_PAYER_TYPE,
          ),

        start_date:
          normalizeText(
            answer?.START_DATE,
          ),

        start_number:
          normalizeText(
            answer?.START_NUM,
          ),

        end_date:
          normalizeText(
            answer?.END_DATE,
          ),

        end_number:
          normalizeText(
            answer?.END_NUM,
          ),
      }),
    )
    .filter(
      hasObjectValue,
    );
}

function createBaseRecord(
  subject,
  recordType,
) {
  return {
    schema_version:
      EDR_NORMALIZED_SCHEMA_VERSION,

    record_type:
      recordType,

    record_number:
      normalizeText(
        subject?.RECORD,
      ),

    name:
      normalizeText(
        subject?.NAME,
      ),

    short_name:
      null,

    status:
      normalizeText(
        subject?.STAN,
      ),

    edrpou:
      null,

    legal_form:
      null,

    registration:
      normalizeText(
        subject?.REGISTRATION,
      ),

    farmer:
      null,

    estate_manager:
      null,

    founding_document_number:
      null,

    executive_power:
      null,

    purpose:
      null,

    founders: [],

    beneficiaries: [],

    superior_management:
      null,

    signers: [],

    authorized_capital:
      null,

    members: [],

    statute:
      null,

    managing_paper:
      null,

    branches: [],

    termination_started:
      null,

    bankruptcy_readjustment:
      null,

    predecessors: [],

    assignees: [],

    terminated_info:
      normalizeText(
        subject?.TERMINATED_INFO,
      ),

    termination_cancel_info:
      normalizeText(
        subject?.TERMINATION_CANCEL_INFO,
      ),

    exchange_answers:
      normalizeExchangeAnswers(
        subject?.EXCHANGE_DATA,
      ),
  };
}

export function
normalizeEdrOrganizationSubject(
  subject = {},
) {
  return {
    ...createBaseRecord(
      subject,
      EDR_RECORD_TYPES
        .ORGANIZATION,
    ),

    short_name:
      normalizeText(
        subject.SHORT_NAME,
      ),

    edrpou:
      normalizeCompactText(
        subject.EDRPOU,
      ),

    legal_form:
      normalizeText(
        subject.OPF,
      ),

    founding_document_number:
      normalizeText(
        subject.FOUNDING_DOCUMENT_NUM,
      ),

    executive_power:
      normalizeExecutivePower(
        subject.EXECUTIVE_POWER,
      ),

    purpose:
      normalizeText(
        subject.PURPOSE,
      ),

    founders:
      normalizeStringList(
        subject.FOUNDERS,
        "FOUNDER",
      ),

    beneficiaries:
      normalizeStringList(
        subject.BENEFICIARIES,
        "BENEFICIARY",
      ),

    superior_management:
      normalizeText(
        subject.SUPERIOR_MANAGEMENT,
      ),

    signers:
      normalizeStringList(
        subject.SIGNERS,
        "SIGNER",
      ),

    authorized_capital:
      normalizeText(
        subject.AUTHORIZED_CAPITAL,
      ),

    members:
      normalizeStringList(
        subject.MEMBERS,
        "MEMBER",
      ),

    statute:
      normalizeText(
        subject.STATUTE,
      ),

    managing_paper:
      normalizeText(
        subject.MANAGING_PAPER,
      ),

    branches:
      normalizeBranches(
        subject.BRANCHES,
      ),

    termination_started:
      normalizeTerminationStarted(
        subject.TERMINATION_STARTED_INFO,
      ),

    bankruptcy_readjustment:
      normalizeBankruptcy(
        subject.BANKRUPTCY_READJUSTMENT_INFO,
      ),

    predecessors:
      normalizeOrganizationLinks(
        subject.PREDECESSORS,
        "PREDECESSOR",
      ),

    assignees:
      normalizeOrganizationLinks(
        subject.ASSIGNEES,
        "ASSIGNEE",
      ),
  };
}

export function
normalizeEdrFopSubject(
  subject = {},
) {
  return {
    ...createBaseRecord(
      subject,
      EDR_RECORD_TYPES.FOP,
    ),

    farmer:
      normalizeText(
        subject.FARMER,
      ),

    estate_manager:
      normalizeText(
        subject.ESTATE_MANAGER,
      ),
  };
}

export function
normalizeEdrSubject(
  subject,
  {
    recordType,
  } = {},
) {
  const normalizedType =
    String(
      recordType ?? "",
    )
      .trim()
      .toLowerCase();

  if (
    normalizedType ===
      "uo" ||
    normalizedType ===
      "organization"
  ) {
    return normalizeEdrOrganizationSubject(
      subject,
    );
  }

  if (
    normalizedType ===
      "fop"
  ) {
    return normalizeEdrFopSubject(
      subject,
    );
  }

  throw new TypeError(
    "Unsupported EDR record type",
  );
}
