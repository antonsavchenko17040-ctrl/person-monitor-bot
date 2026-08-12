import {
  createRequire,
} from "node:module";

import PDFDocument from "pdfkit";

import {
  DOSSIER_EXPORT_MODEL_VERSION,
} from "./dossier-export-model.js";


export const DOSSIER_PDF_VERSION =
  "dossier-pdf-v1";

export const DOSSIER_PDF_CONTENT_TYPE =
  "application/pdf";


const require =
  createRequire(
    import.meta.url
  );

const PDF_FONTS = {
  regular:
    require.resolve(
      "dejavu-fonts-ttf/ttf/DejaVuSans.ttf"
    ),

  bold:
    require.resolve(
      "dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"
    ),
};


const COLORS = {
  navy:
    "#17365D",

  blue:
    "#2F75B5",

  paleBlue:
    "#D9EAF7",

  gray:
    "#666666",

  paleGray:
    "#F2F2F2",

  text:
    "#1F1F1F",

  border:
    "#B4C6E7",

  link:
    "#0563C1",
};


function isRecord(value) {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  );
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


function valueOrNull(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  return normalized ||
    null;
}


function scalarList(value) {
  return Array.isArray(value)
    ? value
        .filter(
          (item) =>
            typeof item ===
              "string" ||
            typeof item ===
              "number"
        )
        .map(valueOrNull)
        .filter(Boolean)
    : [];
}


function records(value) {
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

  return null;
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

  const result =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(
    result.getTime()
  )
    ? null
    : result;
}


function evidenceUrls(value) {
  return records(value)
    .map(
      (item) =>
        valueOrNull(
          item.url
        )
    )
    .filter(Boolean);
}



function buildPdfCareer(model) {
  return {
    items:
      records(
        model.career
          ?.items
      ).map(
        (item) => ({
          year:
            item.year ??
            null,

          organization:
            valueOrNull(
              item.organization
            ),

          position:
            valueOrNull(
              item.position
            ),

          statement_type:
            valueOrNull(
              item.statement_type
            ),

          evidence_urls:
            evidenceUrls(
              item.evidence
            ),
        })
      ),

    transitions:
      records(
        model.career
          ?.transitions
      ).map(
        (item) => ({
          from_year:
            item.from_year ??
            null,

          to_year:
            item.to_year ??
            null,

          organization_changed:
            yesNo(
              item.organization_changed
            ),

          position_changed:
            yesNo(
              item.position_changed
            ),

          statement_type:
            valueOrNull(
              item.statement_type
            ),

          evidence_urls:
            evidenceUrls(
              item.evidence
            ),
        })
      ),
  };
}


function buildPdfRelatedPeople(model) {
  return {
    items:
      records(
        model.related_people
          ?.items
      ).map(
        (item) => ({
          full_name:
            valueOrNull(
              item.full_name
            ),

          relation_type:
            valueOrNull(
              item.relation_type
            ),

          role:
            valueOrNull(
              item.role
            ),

          relationship:
            valueOrNull(
              item.relationship
            ),

          years:
            scalarList(
              item.years
            ),

          identity_status:
            valueOrNull(
              item.identity_status
            ),

          review_required:
            yesNo(
              item.review_required
            ),

          statement_type:
            valueOrNull(
              item.statement_type
            ),

          evidence_urls:
            evidenceUrls(
              item.evidence
            ),
        })
      ),
  };
}


function buildPdfRelations(model) {
  return {
    items:
      records(
        model.relations
          ?.items
      ).map(
        (item) => ({
          relation_type:
            valueOrNull(
              item.relation_type
            ),

          relation_scope:
            valueOrNull(
              item.relation_scope
            ),

          label:
            valueOrNull(
              item.label
            ),

          from_entity_type:
            valueOrNull(
              item.from_entity_type
            ),

          from_name:
            valueOrNull(
              item.from_name
            ),

          to_entity_type:
            valueOrNull(
              item.to_entity_type
            ),

          to_name:
            valueOrNull(
              item.to_name
            ),

          year:
            item.year ??
            null,

          confidence:
            item.confidence ??
            null,

          verification_status:
            valueOrNull(
              item.verification_status
            ),

          source:
            valueOrNull(
              item.source
            ),

          relation_semantics:
            valueOrNull(
              item.relation_semantics
            ),

          statement_type:
            valueOrNull(
              item.statement_type
            ),

          evidence_urls:
            evidenceUrls(
              item.evidence
            ),
        })
      ),
  };
}



function safePdfCurrencyAmounts(value) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(
      value
    )
      .filter(
        ([currency, amount]) =>
          valueOrNull(
            currency
          ) &&
          typeof amount ===
            "number" &&
          Number.isFinite(
            amount
          )
      )
      .map(
        ([currency, amount]) => [
          String(
            currency
          ),
          amount,
        ]
      )
  );
}


function safePdfIncomeSourceDetails(value) {
  const source =
    isRecord(value)
      ? value
      : {};

  return {
    legal_entity_name:
      valueOrNull(
        source.legal_entity_name
      ),

    legal_entity_code:
      valueOrNull(
        source.legal_entity_code
      ),

    edrpou:
      valueOrNull(
        source.edrpou
      ),

    foreign_company_name:
      valueOrNull(
        source.foreign_company_name
      ),

    foreign_company_code:
      valueOrNull(
        source.foreign_company_code
      ),

    person_name:
      valueOrNull(
        source.person_name
      ),
  };
}


function safePdfRights(value) {
  return records(
    value
  ).map(
    (right) => ({
      right_type:
        valueOrNull(
          right.right_type
        ),

      ownership_percentage:
        typeof right
          .ownership_percentage ===
          "number"
          ? right
              .ownership_percentage
          : null,

      percentage:
        typeof right
          .percentage ===
          "number"
          ? right.percentage
          : null,

      share:
        valueOrNull(
          right.share
        ),

      owner_role:
        valueOrNull(
          right.owner_role
        ),

      owner_name:
        valueOrNull(
          right.owner_name
        ),

      owner_relationship:
        valueOrNull(
          right.owner_relationship
        ),
    })
  );
}


function buildPdfIncome(model) {
  return {
    yearly:
      records(
        model.income
          ?.yearly
      ).map(
        (item) => ({
          year:
            item.year ??
            null,

          declarant_uah:
            typeof item
              .declarant_uah ===
              "number"
              ? item.declarant_uah
              : null,

          family_uah:
            typeof item
              .family_uah ===
              "number"
              ? item.family_uah
              : null,

          household_uah:
            typeof item
              .household_uah ===
              "number"
              ? item.household_uah
              : null,

          statement_type:
            valueOrNull(
              item.statement_type
            ),

          evidence_urls:
            evidenceUrls(
              item.evidence
            ),
        })
      ),

    sources:
      records(
        model.income
          ?.sources
      ).map(
        (item) => ({
          year:
            item.year ??
            null,

          recipient_role:
            valueOrNull(
              item.recipient_role
            ),

          recipient_name:
            valueOrNull(
              item.recipient_name
            ),

          recipient_relationship:
            valueOrNull(
              item.recipient_relationship
            ),

          income_type:
            valueOrNull(
              item.income_type
            ),

          other_income_type:
            valueOrNull(
              item.other_income_type
            ),

          amount:
            typeof item.amount ===
              "number"
              ? item.amount
              : null,

          currency:
            valueOrNull(
              item.currency
            ),

          source:
            valueOrNull(
              item.source
            ),

          source_details:
            safePdfIncomeSourceDetails(
              item.source_details
            ),

          statement_type:
            valueOrNull(
              item.statement_type
            ),

          evidence_urls:
            evidenceUrls(
              item.evidence
            ),
        })
      ),
  };
}


function buildPdfCashAssets(model) {
  return {
    yearly:
      records(
        model.cash_assets
          ?.yearly
      ).map(
        (yearItem) => ({
          year:
            yearItem.year ??
            null,

          declarant_by_currency:
            safePdfCurrencyAmounts(
              yearItem
                .declarant_by_currency
            ),

          household_by_currency:
            safePdfCurrencyAmounts(
              yearItem
                .household_by_currency
            ),

          items:
            records(
              yearItem.items
            ).map(
              (item) => ({
                asset_type:
                  valueOrNull(
                    item.asset_type
                  ),

                other_asset_type:
                  valueOrNull(
                    item.other_asset_type
                  ),

                amount:
                  typeof item.amount ===
                    "number"
                    ? item.amount
                    : null,

                currency:
                  valueOrNull(
                    item.currency
                  ),

                organization_type:
                  valueOrNull(
                    item.organization_type
                  ),

                organization_name:
                  valueOrNull(
                    item.organization_name
                  ),

                owner_role:
                  valueOrNull(
                    item.owner_role
                  ),

                owner_name:
                  valueOrNull(
                    item.owner_name
                  ),

                owner_relationship:
                  valueOrNull(
                    item.owner_relationship
                  ),

                rights:
                  safePdfRights(
                    item.rights
                  ),

                statement_type:
                  valueOrNull(
                    item.statement_type
                  ),

                evidence_urls:
                  evidenceUrls(
                    item.evidence
                  ),
              })
            ),

          evidence_urls:
            evidenceUrls(
              yearItem.evidence
            ),
        })
      ),
  };
}



function safePdfLocation(value) {
  const source =
    isRecord(value)
      ? value
      : {};

  return {
    country:
      valueOrNull(
        source.country
      ),

    region:
      valueOrNull(
        source.region
      ),

    district:
      valueOrNull(
        source.district
      ),

    city:
      valueOrNull(
        source.city
      ),
  };
}


function buildPdfRealEstate(model) {
  return {
    yearly:
      records(
        model.real_estate
          ?.yearly
      ).map(
        (yearItem) => ({
          year:
            yearItem.year ??
            null,

          items:
            records(
              yearItem.items
            ).map(
              (item) => ({
                object_type:
                  valueOrNull(
                    item.object_type
                  ),

                other_object_type:
                  valueOrNull(
                    item.other_object_type
                  ),

                area:
                  typeof item.area ===
                    "number" &&
                  Number.isFinite(
                    item.area
                  )
                    ? item.area
                    : null,

                area_unit:
                  valueOrNull(
                    item.area_unit
                  ),

                location:
                  safePdfLocation(
                    item.location
                  ),

                acquisition_date:
                  valueOrNull(
                    item.acquisition_date
                  ),

                cost:
                  typeof item.cost ===
                    "number" &&
                  Number.isFinite(
                    item.cost
                  )
                    ? item.cost
                    : null,

                owner_role:
                  valueOrNull(
                    item.owner_role
                  ),

                owner_name:
                  valueOrNull(
                    item.owner_name
                  ),

                owner_relationship:
                  valueOrNull(
                    item.owner_relationship
                  ),

                rights:
                  safePdfRights(
                    item.rights
                  ),

                statement_type:
                  valueOrNull(
                    item.statement_type
                  ),

                evidence_urls:
                  evidenceUrls(
                    item.evidence
                  ),
              })
            ),

          evidence_urls:
            evidenceUrls(
              yearItem.evidence
            ),
        })
      ),
  };
}


function buildPdfVehicles(model) {
  return {
    yearly:
      records(
        model.vehicles
          ?.yearly
      ).map(
        (yearItem) => ({
          year:
            yearItem.year ??
            null,

          items:
            records(
              yearItem.items
            ).map(
              (item) => ({
                object_type:
                  valueOrNull(
                    item.object_type
                  ),

                other_object_type:
                  valueOrNull(
                    item.other_object_type
                  ),

                brand:
                  valueOrNull(
                    item.brand
                  ),

                model:
                  valueOrNull(
                    item.model
                  ),

                production_year:
                  item.production_year ??
                  null,

                acquisition_date:
                  valueOrNull(
                    item.acquisition_date
                  ),

                cost:
                  typeof item.cost ===
                    "number" &&
                  Number.isFinite(
                    item.cost
                  )
                    ? item.cost
                    : null,

                owner_role:
                  valueOrNull(
                    item.owner_role
                  ),

                owner_name:
                  valueOrNull(
                    item.owner_name
                  ),

                owner_relationship:
                  valueOrNull(
                    item.owner_relationship
                  ),

                rights:
                  safePdfRights(
                    item.rights
                  ),

                statement_type:
                  valueOrNull(
                    item.statement_type
                  ),

                evidence_urls:
                  evidenceUrls(
                    item.evidence
                  ),
              })
            ),

          evidence_urls:
            evidenceUrls(
              yearItem.evidence
            ),
        })
      ),
  };
}



function safePdfAnalyticsDetails(value) {
  const source =
    isRecord(value)
      ? value
      : {};

  const allowed = [
    "from_year",
    "to_year",
    "cash_uah_delta",
    "current_income_uah",
    "ratio",
    "income_delta_uah",
    "income_delta_percent",
    "count_delta",
    "previous_count",
    "current_count",
    "organization_changed",
    "position_changed",
  ];

  return Object.fromEntries(
    allowed
      .filter(
        (key) => {
          const item =
            source[key];

          return (
            typeof item ===
              "string" ||
            typeof item ===
              "boolean" ||
            (
              typeof item ===
                "number" &&
              Number.isFinite(
                item
              )
            )
          );
        }
      )
      .map(
        (key) => [
          key,
          source[key],
        ]
      )
  );
}


function buildPdfAnalytics(model) {
  return {
    metrics:
      records(
        model.analytics
          ?.metrics
      ).map(
        (item) => ({
          year:
            item.year ??
            null,

          income_declarant_uah:
            typeof item
              .income_declarant_uah ===
              "number" &&
            Number.isFinite(
              item
                .income_declarant_uah
            )
              ? item
                  .income_declarant_uah
              : null,

          income_household_uah:
            typeof item
              .income_household_uah ===
              "number" &&
            Number.isFinite(
              item
                .income_household_uah
            )
              ? item
                  .income_household_uah
              : null,

          cash_declarant_by_currency:
            safePdfCurrencyAmounts(
              item
                .cash_declarant_by_currency
            ),

          cash_household_by_currency:
            safePdfCurrencyAmounts(
              item
                .cash_household_by_currency
            ),

          real_estate_items:
            typeof item
              .real_estate_items ===
              "number"
              ? item.real_estate_items
              : null,

          vehicle_items:
            typeof item
              .vehicle_items ===
              "number"
              ? item.vehicle_items
              : null,

          relation_count:
            typeof item
              .relation_count ===
              "number"
              ? item.relation_count
              : null,

          career: {
            organization:
              valueOrNull(
                item.career
                  ?.organization
              ),

            position:
              valueOrNull(
                item.career
                  ?.position
              ),
          },

          statement_type:
            valueOrNull(
              item.statement_type
            ),

          evidence_urls:
            evidenceUrls(
              item.evidence
            ),
        })
      ),

    transitions:
      records(
        model.analytics
          ?.transitions
      ).map(
        (item) => ({
          from_year:
            item.from_year ??
            null,

          to_year:
            item.to_year ??
            null,

          year_gap:
            typeof item.year_gap ===
              "number"
              ? item.year_gap
              : null,

          income_delta_uah:
            typeof item
              .income_delta_uah ===
              "number"
              ? item.income_delta_uah
              : null,

          income_delta_percent:
            typeof item
              .income_delta_percent ===
              "number"
              ? item
                  .income_delta_percent
              : null,

          cash_uah_delta:
            typeof item
              .cash_uah_delta ===
              "number"
              ? item.cash_uah_delta
              : null,

          real_estate_count_delta:
            typeof item
              .real_estate_count_delta ===
              "number"
              ? item
                  .real_estate_count_delta
              : null,

          vehicle_count_delta:
            typeof item
              .vehicle_count_delta ===
              "number"
              ? item
                  .vehicle_count_delta
              : null,

          organization_changed:
            yesNo(
              item.organization_changed
            ),

          position_changed:
            yesNo(
              item.position_changed
            ),

          statement_type:
            valueOrNull(
              item.statement_type
            ),

          evidence_urls:
            evidenceUrls(
              item.evidence
            ),
        })
      ),

    findings:
      records(
        model.analytics
          ?.findings
      ).map(
        (item) => ({
          rule_code:
            valueOrNull(
              item.rule_code
            ),

          domain:
            valueOrNull(
              item.domain
            ),

          result:
            valueOrNull(
              item.result
            ),

          severity:
            valueOrNull(
              item.severity
            ),

          score:
            typeof item.score ===
              "number"
              ? item.score
              : null,

          message:
            valueOrNull(
              item.message
            ),

          details:
            safePdfAnalyticsDetails(
              item.details
            ),

          statement_type:
            valueOrNull(
              item.statement_type
            ),

          evidence_urls:
            evidenceUrls(
              item.evidence
            ),
        })
      ),
  };
}



function buildPdfMentions(model) {
  const items =
    records(
      model.mentions
        ?.items
    ).map(
      (item) => ({
        provider:
          valueOrNull(
            item.provider
          ),

        source:
          valueOrNull(
            item.source
          ),

        title:
          valueOrNull(
            item.title
          ),

        snippet:
          valueOrNull(
            item.snippet
          ),

        url:
          valueOrNull(
            item.url
          ),

        published_at:
          valueOrNull(
            item.published_at
          ),

        first_seen_at:
          valueOrNull(
            item.first_seen_at
          ),

        match_score:
          typeof item
            .match_score ===
            "number" &&
          Number.isFinite(
            item.match_score
          )
            ? item.match_score
            : null,

        match_level:
          valueOrNull(
            item.match_level
          ),

        reasons:
          scalarList(
            item.reasons
          ),

        statement_type:
          valueOrNull(
            item.statement_type
          ) ??
          "source_fact",

        evidence_urls:
          evidenceUrls(
            item.evidence
          ),
      })
    );

  return {
    total:
      typeof model.mentions
        ?.total ===
        "number" &&
      Number.isFinite(
        model.mentions.total
      )
        ? model.mentions.total
        : items.length,

    items,
  };
}



function buildPdfSources(model) {
  return records(
    model.sources
  ).map(
    (item) => ({
      provider:
        valueOrNull(
          item.provider
        ),

      source_type:
        valueOrNull(
          item.source_type
        ),

      title:
        valueOrNull(
          item.title
        ),

      url:
        valueOrNull(
          item.url
        ),

      published_at:
        valueOrNull(
          item.published_at
        ),

      observed_at:
        valueOrNull(
          item.observed_at
        ),
    })
  );
}


export function buildDossierPdfContent(
  inputModel
) {
  const model =
    requiredModel(
      inputModel
    );

  const declarations =
    records(
      model.declarations
        ?.items
    ).map(
      (item) => ({
        year:
          item.year ??
          null,

        registry:
          valueOrNull(
            item.registry
          ),

        document_guid:
          valueOrNull(
            item.document_guid
          ),

        published_at:
          valueOrNull(
            item.published_at
          ),

        canonical:
          yesNo(
            item.canonical
          ),

        source_url:
          valueOrNull(
            item.source_url
          ),

        evidence_urls:
          evidenceUrls(
            item.evidence
          ),
      })
    );

  const findings =
    records(
      model
        .executive_summary
        ?.items
    ).map(
      (item) => ({
        rule_code:
          valueOrNull(
            item.rule_code
          ),

        domain:
          valueOrNull(
            item.domain
          ),

        result:
          valueOrNull(
            item.result
          ),

        severity:
          valueOrNull(
            item.severity
          ),

        score:
          item.score ??
          null,

        message:
          valueOrNull(
            item.message
          ),

        evidence_urls:
          evidenceUrls(
            item.evidence
          ),
      })
    );

  return {
    title:
      "Аналітичне досьє",

    subject: {
      full_name:
        valueOrNull(
          model.subject
            ?.full_name
        ),

      position:
        valueOrNull(
          model.subject
            ?.position
        ),

      organization:
        valueOrNull(
          model.subject
            ?.organization
        ),

      city:
        valueOrNull(
          model.subject
            ?.city
        ),

      status:
        valueOrNull(
          model.subject
            ?.status
        ),
    },

    overview: {
      schema_version:
        valueOrNull(
          model.meta
            ?.schema_version
        ),

      analytics_version:
        valueOrNull(
          model.meta
            ?.analytics_version
        ),

      from_year:
        model.meta
          ?.period
          ?.from_year ??
        null,

      to_year:
        model.meta
          ?.period
          ?.to_year ??
        null,

      available_years:
        scalarList(
          model.meta
            ?.available_years
        ),

      freshness:
        scalarList(
          model.meta
            ?.freshness
        ),
    },

    identity: {
      resolution_status:
        valueOrNull(
          model.identity
            ?.resolution_status
        ),

      score:
        model.identity
          ?.score ??
        null,

      hard_match:
        yesNo(
          model.identity
            ?.hard_match
        ),

      review_required:
        yesNo(
          model.identity
            ?.review_required
        ),

      identifiers:
        scalarList(
          model.identity
            ?.identifiers
        ),

      aliases:
        scalarList(
          model.identity
            ?.aliases
        ),

      reasons:
        scalarList(
          model.identity
            ?.reasons
        ),
    },

    declarations,

    executive_summary: {
      status:
        valueOrNull(
          model
            .executive_summary
            ?.status
        ),

      items:
        findings,
    },

    income:
      buildPdfIncome(
        model
      ),

    cash_assets:
      buildPdfCashAssets(
        model
      ),

    real_estate:
      buildPdfRealEstate(
        model
      ),

    vehicles:
      buildPdfVehicles(
        model
      ),

    analytics:
      buildPdfAnalytics(
        model
      ),

    mentions:
      buildPdfMentions(
        model
      ),

    sources:
      buildPdfSources(
        model
      ),

    career:
      buildPdfCareer(
        model
      ),

    related_people:
      buildPdfRelatedPeople(
        model
      ),

    relations:
      buildPdfRelations(
        model
      ),

    audit: {
      dossier_version_id:
        valueOrNull(
          model.dossier
            ?.version_id
        ),

      dossier_status:
        valueOrNull(
          model.dossier
            ?.status
        ),

      report_schema_version:
        valueOrNull(
          model.dossier
            ?.report_schema_version
        ),

      report_generated_at:
        valueOrNull(
          model.dossier
            ?.report_generated_at
        ),

      payload_hash:
        valueOrNull(
          model.dossier
            ?.payload_hash
        ),

      payload_hash_version:
        valueOrNull(
          model.dossier
            ?.payload_hash_version
        ),

      created_at:
        valueOrNull(
          model.dossier
            ?.created_at
        ),

      export_contract:
        DOSSIER_PDF_VERSION,
    },

    methodology: {
      report_model_version:
        valueOrNull(
          model.methodology
            ?.report_model_version
        ),

      analytics_version:
        valueOrNull(
          model.methodology
            ?.analytics_version
        ),

      rules_version:
        valueOrNull(
          model.methodology
            ?.rules_version
        ),

      analytical_brief_version:
        valueOrNull(
          model.methodology
            ?.analytical_brief_version
        ),

      evidence_policy_version:
        valueOrNull(
          model.methodology
            ?.evidence_policy_version
        ),

      manual_review_manifest_version:
        valueOrNull(
          model.methodology
            ?.manual_review_manifest_version
        ),

      notes:
        scalarList(
          model.methodology
            ?.notes
        ),

      limitations:
        scalarList(
          model.methodology
            ?.limitations
        ),
    },
  };
}


function ensureSpace(
  doc,
  height = 70
) {
  const bottom =
    doc.page.height -
    doc.page.margins.bottom -
    24;

  if (
    doc.y +
    height >
    bottom
  ) {
    doc.addPage();
  }
}


function addHeading(
  doc,
  title,
  size = 14
) {
  ensureSpace(
    doc,
    46
  );

  doc
    .moveDown(
      0.55
    )
    .font(
      "Bold"
    )
    .fontSize(
      size
    )
    .fillColor(
      COLORS.navy
    )
    .text(
      title,
      {
        paragraphGap:
          4,
      }
    );

  doc
    .moveTo(
      doc.page.margins.left,
      doc.y
    )
    .lineTo(
      doc.page.width -
      doc.page.margins.right,
      doc.y
    )
    .strokeColor(
      COLORS.border
    )
    .stroke();

  doc.moveDown(
    0.4
  );
}


function addKeyValue(
  doc,
  label,
  value
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() ===
      ""
  ) {
    return;
  }

  ensureSpace(
    doc,
    24
  );

  doc
    .font(
      "Bold"
    )
    .fontSize(
      9.5
    )
    .fillColor(
      COLORS.navy
    )
    .text(
      `${label}: `,
      {
        continued:
          true,
      }
    )
    .font(
      "Regular"
    )
    .fillColor(
      COLORS.text
    )
    .text(
      String(value)
    );
}


function addUrl(
  doc,
  url,
  label =
    "Відкрити першоджерело"
) {
  const safeUrl =
    valueOrNull(
      url
    );

  if (!safeUrl) {
    return;
  }

  ensureSpace(
    doc,
    22
  );

  doc
    .font(
      "Regular"
    )
    .fontSize(
      8.7
    )
    .fillColor(
      COLORS.link
    )
    .text(
      label,
      {
        link:
          safeUrl,

        underline:
          true,
      }
    );
}


function addBullet(
  doc,
  value
) {
  const normalized =
    valueOrNull(
      value
    );

  if (!normalized) {
    return;
  }

  ensureSpace(
    doc,
    28
  );

  doc
    .font(
      "Regular"
    )
    .fontSize(
      9.2
    )
    .fillColor(
      COLORS.text
    )
    .text(
      `- ${normalized}`,
      {
        indent:
          10,

        paragraphGap:
          2,
      }
    );
}


function addCover(
  doc,
  content
) {
  doc
    .font(
      "Bold"
    )
    .fontSize(
      22
    )
    .fillColor(
      COLORS.navy
    )
    .text(
      content.title,
      {
        align:
          "center",
      }
    );

  doc.moveDown(
    0.45
  );

  doc
    .font(
      "Bold"
    )
    .fontSize(
      16
    )
    .fillColor(
      COLORS.text
    )
    .text(
      content.subject
        .full_name ??
      "Без назви",
      {
        align:
          "center",
      }
    );

  const context =
    [
      content.subject
        .position,

      content.subject
        .organization,

      content.subject
        .city,
    ]
      .filter(Boolean)
      .join(
        " | "
      );

  if (context) {
    doc.moveDown(
      0.5
    );

    doc
      .font(
        "Regular"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.gray
      )
      .text(
        context,
        {
          align:
            "center",
        }
      );
  }

  doc.moveDown(
    0.8
  );

  doc
    .font(
      "Regular"
    )
    .fontSize(
      9
    )
    .fillColor(
      COLORS.gray
    )
    .text(
      [
        content.audit
          .report_generated_at
          ? `Snapshot: ${content.audit.report_generated_at}`
          : null,

        content.audit
          .dossier_version_id
          ? `Версія: ${content.audit.dossier_version_id}`
          : null,
      ]
        .filter(Boolean)
        .join(
          " | "
        ),
      {
        align:
          "center",
      }
    );
}


function addOverview(
  doc,
  content
) {
  addHeading(
    doc,
    "Профіль та декларації"
  );

  addKeyValue(
    doc,
    "Статус",
    content.subject.status
  );

  const period =
    content.overview
      .from_year !==
        null &&
    content.overview
      .to_year !==
        null
      ? `${content.overview.from_year} - ${content.overview.to_year}`
      : null;

  addKeyValue(
    doc,
    "Період",
    period
  );

  addKeyValue(
    doc,
    "Доступні роки",
    content.overview
      .available_years
      .join(
        ", "
      )
  );

  addHeading(
    doc,
    "Ідентифікація",
    12
  );

  addKeyValue(
    doc,
    "Статус",
    content.identity
      .resolution_status
  );

  addKeyValue(
    doc,
    "Бал",
    content.identity
      .score
  );

  addKeyValue(
    doc,
    "Hard match",
    content.identity
      .hard_match
  );

  addKeyValue(
    doc,
    "Потребує перевірки",
    content.identity
      .review_required
  );

  addKeyValue(
    doc,
    "Ідентифікатори",
    content.identity
      .identifiers
      .join(
        "; "
      )
  );

  addKeyValue(
    doc,
    "Аліаси",
    content.identity
      .aliases
      .join(
        "; "
      )
  );

  addKeyValue(
    doc,
    "Підстави",
    content.identity
      .reasons
      .join(
        "; "
      )
  );

  addHeading(
    doc,
    `Декларації - ${content.declarations.length}`,
    12
  );

  if (
    !content.declarations
      .length
  ) {
    addBullet(
      doc,
      "Декларації відсутні."
    );

    return;
  }

  for (
    const item
    of content.declarations
  ) {
    ensureSpace(
      doc,
      90
    );

    const title =
      [
        item.year,
        item.registry,
      ]
        .filter(Boolean)
        .join(
          " | "
        ) ||
      "Декларація";

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        title
      );

    addKeyValue(
      doc,
      "GUID",
      item.document_guid
    );

    addKeyValue(
      doc,
      "Опубліковано",
      item.published_at
    );

    addKeyValue(
      doc,
      "Canonical",
      item.canonical
    );

    if (
      item.source_url
    ) {
      addUrl(
        doc,
        item.source_url
      );
    } else {
      for (
        const url
        of item.evidence_urls
      ) {
        addUrl(
          doc,
          url
        );
      }
    }

    doc.moveDown(
      0.45
    );
  }
}


function addExecutiveSummary(
  doc,
  content
) {
  addHeading(
    doc,
    "Ключові сигнали"
  );

  addKeyValue(
    doc,
    "Статус",
    content
      .executive_summary
      .status
  );

  const items =
    content
      .executive_summary
      .items;

  if (!items.length) {
    addBullet(
      doc,
      "Аналітичні сигнали не сформовані."
    );

    return;
  }

  for (
    let index = 0;
    index <
    items.length;
    index += 1
  ) {
    const item =
      items[index];

    ensureSpace(
      doc,
      105
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        `${index + 1}. ${
          item.message ??
          item.rule_code ??
          "Сигнал"
        }`
      );

    addKeyValue(
      doc,
      "Правило",
      item.rule_code
    );

    addKeyValue(
      doc,
      "Домен",
      item.domain
    );

    addKeyValue(
      doc,
      "Результат",
      item.result
    );

    addKeyValue(
      doc,
      "Severity",
      item.severity
    );

    addKeyValue(
      doc,
      "Score",
      item.score
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.45
    );
  }
}



function addCareerRelations(
  doc,
  content
) {
  addHeading(
    doc,
    "Кар’єра та зв’язки"
  );

  addHeading(
    doc,
    `Кар’єра - ${content.career.items.length}`,
    12
  );

  if (
    !content.career
      .items.length
  ) {
    addBullet(
      doc,
      "Дані про кар’єру відсутні."
    );
  }

  for (
    const item
    of content.career.items
  ) {
    ensureSpace(
      doc,
      88
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        [
          item.year,
          item.organization,
        ]
          .filter(Boolean)
          .join(
            " | "
          ) ||
        "Кар’єрний запис"
      );

    addKeyValue(
      doc,
      "Посада",
      item.position
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.4
    );
  }

  addHeading(
    doc,
    `Зміни кар’єри - ${content.career.transitions.length}`,
    12
  );

  if (
    !content.career
      .transitions.length
  ) {
    addBullet(
      doc,
      "Зафіксовані переходи відсутні."
    );
  }

  for (
    const item
    of content.career
      .transitions
  ) {
    ensureSpace(
      doc,
      90
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        `${
          item.from_year ??
          "?"
        } → ${
          item.to_year ??
          "?"
        }`
      );

    addKeyValue(
      doc,
      "Організація змінилась",
      item.organization_changed
    );

    addKeyValue(
      doc,
      "Посада змінилась",
      item.position_changed
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.4
    );
  }

  addHeading(
    doc,
    `Пов’язані особи - ${content.related_people.items.length}`,
    12
  );

  if (
    !content.related_people
      .items.length
  ) {
    addBullet(
      doc,
      "Пов’язані особи відсутні."
    );
  }

  for (
    const item
    of content.related_people
      .items
  ) {
    ensureSpace(
      doc,
      105
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        item.full_name ??
        "Пов’язана особа"
      );

    addKeyValue(
      doc,
      "Тип зв’язку",
      item.relation_type
    );

    addKeyValue(
      doc,
      "Роль",
      item.role
    );

    addKeyValue(
      doc,
      "Стосунок",
      item.relationship
    );

    addKeyValue(
      doc,
      "Роки",
      item.years.join(
        ", "
      )
    );

    addKeyValue(
      doc,
      "Identity status",
      item.identity_status
    );

    addKeyValue(
      doc,
      "Потребує перевірки",
      item.review_required
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.4
    );
  }

  addHeading(
    doc,
    `Зв’язки - ${content.relations.items.length}`,
    12
  );

  if (
    !content.relations
      .items.length
  ) {
    addBullet(
      doc,
      "Зв’язки відсутні."
    );
  }

  for (
    const item
    of content.relations
      .items
  ) {
    ensureSpace(
      doc,
      130
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        [
          item.from_name,
          item.to_name,
        ]
          .filter(Boolean)
          .join(
            " → "
          ) ||
        item.label ||
        item.relation_type ||
        "Зв’язок"
      );

    addKeyValue(
      doc,
      "Тип",
      item.relation_type
    );

    addKeyValue(
      doc,
      "Scope",
      item.relation_scope
    );

    addKeyValue(
      doc,
      "Label",
      item.label
    );

    addKeyValue(
      doc,
      "Рік",
      item.year
    );

    addKeyValue(
      doc,
      "Confidence",
      item.confidence
    );

    addKeyValue(
      doc,
      "Verification",
      item.verification_status
    );

    addKeyValue(
      doc,
      "Джерело",
      item.source
    );

    addKeyValue(
      doc,
      "Семантика",
      item.relation_semantics
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.45
    );
  }
}



function formatPdfAmount(value) {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value
    )
  ) {
    return null;
  }

  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits:
        2,
    }
  ).format(
    value
  );
}


function pdfCurrencySummary(value) {
  if (!isRecord(value)) {
    return null;
  }

  const parts =
    Object.entries(
      value
    )
      .filter(
        ([currency, amount]) =>
          valueOrNull(
            currency
          ) &&
          typeof amount ===
            "number" &&
          Number.isFinite(
            amount
          )
      )
      .map(
        ([currency, amount]) =>
          `${currency}: ${formatPdfAmount(amount)}`
      );

  return parts.length
    ? parts.join(
        "; "
      )
    : null;
}


function pdfRightsSummary(value) {
  const items =
    records(
      value
    )
      .map(
        (right) => {
          const percentage =
            right
              .ownership_percentage ??
            right.percentage ??
            null;

          return [
            right.right_type,
            percentage !==
              null
              ? `${percentage}%`
              : null,
            right.share,
            right.owner_name,
          ]
            .filter(Boolean)
            .join(
              " | "
            );
        }
      )
      .filter(Boolean);

  return items.length
    ? items.join(
        "; "
      )
    : null;
}


function addFinances(
  doc,
  content
) {
  addHeading(
    doc,
    "Фінанси"
  );

  addHeading(
    doc,
    `Доходи за роками - ${content.income.yearly.length}`,
    12
  );

  if (
    !content.income
      .yearly.length
  ) {
    addBullet(
      doc,
      "Агреговані доходи відсутні."
    );
  }

  for (
    const item
    of content.income
      .yearly
  ) {
    ensureSpace(
      doc,
      95
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        item.year !==
          null
          ? `Рік ${item.year}`
          : "Доходи"
      );

    addKeyValue(
      doc,
      "Декларант, UAH",
      formatPdfAmount(
        item.declarant_uah
      )
    );

    addKeyValue(
      doc,
      "Сім’я, UAH",
      formatPdfAmount(
        item.family_uah
      )
    );

    addKeyValue(
      doc,
      "Домогосподарство, UAH",
      formatPdfAmount(
        item.household_uah
      )
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.4
    );
  }

  addHeading(
    doc,
    `Джерела доходу - ${content.income.sources.length}`,
    12
  );

  if (
    !content.income
      .sources.length
  ) {
    addBullet(
      doc,
      "Джерела доходу відсутні."
    );
  }

  for (
    const item
    of content.income
      .sources
  ) {
    ensureSpace(
      doc,
      135
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        [
          item.year,
          item.recipient_name,
          item.income_type ||
            item.other_income_type,
        ]
          .filter(Boolean)
          .join(
            " | "
          ) ||
        "Джерело доходу"
      );

    addKeyValue(
      doc,
      "Роль отримувача",
      item.recipient_role
    );

    addKeyValue(
      doc,
      "Стосунок",
      item.recipient_relationship
    );

    addKeyValue(
      doc,
      "Сума",
      [
        formatPdfAmount(
          item.amount
        ),
        item.currency,
      ]
        .filter(Boolean)
        .join(
          " "
        )
    );

    addKeyValue(
      doc,
      "Джерело",
      item.source
    );

    addKeyValue(
      doc,
      "Юридична особа",
      item.source_details
        .legal_entity_name
    );

    addKeyValue(
      doc,
      "Код юридичної особи",
      item.source_details
        .legal_entity_code
    );

    addKeyValue(
      doc,
      "ЄДРПОУ",
      item.source_details
        .edrpou
    );

    addKeyValue(
      doc,
      "Іноземна компанія",
      item.source_details
        .foreign_company_name
    );

    addKeyValue(
      doc,
      "Код іноземної компанії",
      item.source_details
        .foreign_company_code
    );

    addKeyValue(
      doc,
      "Особа-джерело",
      item.source_details
        .person_name
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.45
    );
  }

  addHeading(
    doc,
    `Грошові активи за роками - ${content.cash_assets.yearly.length}`,
    12
  );

  if (
    !content.cash_assets
      .yearly.length
  ) {
    addBullet(
      doc,
      "Грошові активи відсутні."
    );
  }

  for (
    const yearItem
    of content.cash_assets
      .yearly
  ) {
    ensureSpace(
      doc,
      115
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        yearItem.year !==
          null
          ? `Рік ${yearItem.year}`
          : "Грошові активи"
      );

    addKeyValue(
      doc,
      "Декларант",
      pdfCurrencySummary(
        yearItem
          .declarant_by_currency
      )
    );

    addKeyValue(
      doc,
      "Домогосподарство",
      pdfCurrencySummary(
        yearItem
          .household_by_currency
      )
    );

    for (
      const url
      of yearItem
        .evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    for (
      const item
      of yearItem.items
    ) {
      ensureSpace(
        doc,
        125
      );

      doc
        .font(
          "Bold"
        )
        .fontSize(
          9.7
        )
        .fillColor(
          COLORS.text
        )
        .text(
          item.asset_type ||
          item.other_asset_type ||
          "Грошовий актив"
        );

      addKeyValue(
        doc,
        "Сума",
        [
          formatPdfAmount(
            item.amount
          ),
          item.currency,
        ]
          .filter(Boolean)
          .join(
            " "
          )
      );

      addKeyValue(
        doc,
        "Тип організації",
        item.organization_type
      );

      addKeyValue(
        doc,
        "Організація",
        item.organization_name
      );

      addKeyValue(
        doc,
        "Роль власника",
        item.owner_role
      );

      addKeyValue(
        doc,
        "Власник",
        item.owner_name
      );

      addKeyValue(
        doc,
        "Стосунок власника",
        item.owner_relationship
      );

      addKeyValue(
        doc,
        "Права",
        pdfRightsSummary(
          item.rights
        )
      );

      addKeyValue(
        doc,
        "Тип твердження",
        item.statement_type
      );

      for (
        const url
        of item.evidence_urls
      ) {
        addUrl(
          doc,
          url
        );
      }

      doc.moveDown(
        0.4
      );
    }

    doc.moveDown(
      0.35
    );
  }
}



function pdfLocationSummary(value) {
  if (!isRecord(value)) {
    return null;
  }

  const parts =
    [
      value.country,
      value.region,
      value.district,
      value.city,
    ]
      .filter(Boolean);

  return parts.length
    ? parts.join(
        ", "
      )
    : null;
}


function addAssets(
  doc,
  content
) {
  addHeading(
    doc,
    "Активи"
  );

  const estateItems =
    content.real_estate
      .yearly
      .flatMap(
        (yearItem) =>
          yearItem.items.map(
            (item) => ({
              ...item,
              year:
                yearItem.year,
            })
          )
      );

  addHeading(
    doc,
    `Нерухомість - ${estateItems.length}`,
    12
  );

  if (!estateItems.length) {
    addBullet(
      doc,
      "Нерухомість відсутня."
    );
  }

  for (
    const item
    of estateItems
  ) {
    ensureSpace(
      doc,
      145
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        [
          item.year,
          item.object_type ||
            item.other_object_type,
        ]
          .filter(Boolean)
          .join(
            " | "
          ) ||
        "Об’єкт нерухомості"
      );

    addKeyValue(
      doc,
      "Площа",
      [
        item.area,
        item.area_unit,
      ]
        .filter(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).trim()
        )
        .join(
          " "
        )
    );

    addKeyValue(
      doc,
      "Локація",
      pdfLocationSummary(
        item.location
      )
    );

    addKeyValue(
      doc,
      "Дата набуття",
      item.acquisition_date
    );

    addKeyValue(
      doc,
      "Вартість",
      formatPdfAmount(
        item.cost
      )
    );

    addKeyValue(
      doc,
      "Роль власника",
      item.owner_role
    );

    addKeyValue(
      doc,
      "Власник",
      item.owner_name
    );

    addKeyValue(
      doc,
      "Стосунок власника",
      item.owner_relationship
    );

    addKeyValue(
      doc,
      "Права",
      pdfRightsSummary(
        item.rights
      )
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.45
    );
  }

  const vehicleItems =
    content.vehicles
      .yearly
      .flatMap(
        (yearItem) =>
          yearItem.items.map(
            (item) => ({
              ...item,
              year:
                yearItem.year,
            })
          )
      );

  addHeading(
    doc,
    `Транспорт - ${vehicleItems.length}`,
    12
  );

  if (!vehicleItems.length) {
    addBullet(
      doc,
      "Транспорт відсутній."
    );
  }

  for (
    const item
    of vehicleItems
  ) {
    ensureSpace(
      doc,
      145
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        [
          item.year,
          item.brand,
          item.model,
        ]
          .filter(Boolean)
          .join(
            " | "
          ) ||
        item.object_type ||
        item.other_object_type ||
        "Транспортний засіб"
      );

    addKeyValue(
      doc,
      "Тип",
      item.object_type ||
        item.other_object_type
    );

    addKeyValue(
      doc,
      "Марка",
      item.brand
    );

    addKeyValue(
      doc,
      "Модель",
      item.model
    );

    addKeyValue(
      doc,
      "Рік випуску",
      item.production_year
    );

    addKeyValue(
      doc,
      "Дата набуття",
      item.acquisition_date
    );

    addKeyValue(
      doc,
      "Вартість",
      formatPdfAmount(
        item.cost
      )
    );

    addKeyValue(
      doc,
      "Роль власника",
      item.owner_role
    );

    addKeyValue(
      doc,
      "Власник",
      item.owner_name
    );

    addKeyValue(
      doc,
      "Стосунок власника",
      item.owner_relationship
    );

    addKeyValue(
      doc,
      "Права",
      pdfRightsSummary(
        item.rights
      )
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.45
    );
  }
}



function pdfAnalyticsDetailsSummary(value) {
  if (!isRecord(value)) {
    return null;
  }

  const labels = {
    from_year:
      "Від року",

    to_year:
      "До року",

    cash_uah_delta:
      "Зміна cash UAH",

    current_income_uah:
      "Поточний дохід UAH",

    ratio:
      "Співвідношення",

    income_delta_uah:
      "Зміна доходу UAH",

    income_delta_percent:
      "Зміна доходу %",

    count_delta:
      "Зміна кількості",

    previous_count:
      "Було",

    current_count:
      "Стало",

    organization_changed:
      "Організація змінилась",

    position_changed:
      "Посада змінилась",
  };

  const parts =
    Object.entries(
      value
    ).map(
      ([key, item]) => {
        const shown =
          typeof item ===
            "boolean"
            ? yesNo(
                item
              )
            : item;

        return `${
          labels[key] ??
          key
        }: ${shown}`;
      }
    );

  return parts.length
    ? parts.join(
        "; "
      )
    : null;
}


function addAnalytics(
  doc,
  content
) {
  addHeading(
    doc,
    "Аналітика"
  );

  addHeading(
    doc,
    `Метрики - ${content.analytics.metrics.length}`,
    12
  );

  if (
    !content.analytics
      .metrics.length
  ) {
    addBullet(
      doc,
      "Аналітичні метрики відсутні."
    );
  }

  for (
    const item
    of content.analytics
      .metrics
  ) {
    ensureSpace(
      doc,
      145
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        item.year !==
          null
          ? `Рік ${item.year}`
          : "Метрика"
      );

    addKeyValue(
      doc,
      "Дохід декларанта, UAH",
      formatPdfAmount(
        item
          .income_declarant_uah
      )
    );

    addKeyValue(
      doc,
      "Дохід домогосподарства, UAH",
      formatPdfAmount(
        item
          .income_household_uah
      )
    );

    addKeyValue(
      doc,
      "Cash декларанта",
      pdfCurrencySummary(
        item
          .cash_declarant_by_currency
      )
    );

    addKeyValue(
      doc,
      "Cash домогосподарства",
      pdfCurrencySummary(
        item
          .cash_household_by_currency
      )
    );

    addKeyValue(
      doc,
      "Нерухомість",
      item.real_estate_items
    );

    addKeyValue(
      doc,
      "Транспорт",
      item.vehicle_items
    );

    addKeyValue(
      doc,
      "Зв’язки",
      item.relation_count
    );

    addKeyValue(
      doc,
      "Кар’єра",
      [
        item.career
          .organization,
        item.career
          .position,
      ]
        .filter(Boolean)
        .join(
          " | "
        )
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.45
    );
  }

  addHeading(
    doc,
    `Переходи - ${content.analytics.transitions.length}`,
    12
  );

  if (
    !content.analytics
      .transitions.length
  ) {
    addBullet(
      doc,
      "Аналітичні переходи відсутні."
    );
  }

  for (
    const item
    of content.analytics
      .transitions
  ) {
    ensureSpace(
      doc,
      170
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        `${
          item.from_year ??
          "?"
        } → ${
          item.to_year ??
          "?"
        }`
      );

    addKeyValue(
      doc,
      "Різниця років",
      item.year_gap
    );

    addKeyValue(
      doc,
      "Зміна доходу, UAH",
      formatPdfAmount(
        item.income_delta_uah
      )
    );

    addKeyValue(
      doc,
      "Зміна доходу, %",
      item.income_delta_percent
    );

    addKeyValue(
      doc,
      "Зміна cash UAH",
      formatPdfAmount(
        item.cash_uah_delta
      )
    );

    addKeyValue(
      doc,
      "Зміна кількості нерухомості",
      item.real_estate_count_delta
    );

    addKeyValue(
      doc,
      "Зміна кількості транспорту",
      item.vehicle_count_delta
    );

    addKeyValue(
      doc,
      "Організація змінилась",
      item.organization_changed
    );

    addKeyValue(
      doc,
      "Посада змінилась",
      item.position_changed
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.45
    );
  }

  addHeading(
    doc,
    `Аналітичні знахідки - ${content.analytics.findings.length}`,
    12
  );

  if (
    !content.analytics
      .findings.length
  ) {
    addBullet(
      doc,
      "Аналітичні знахідки відсутні."
    );
  }

  for (
    const item
    of content.analytics
      .findings
  ) {
    ensureSpace(
      doc,
      150
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        item.message ||
        item.rule_code ||
        "Аналітична знахідка"
      );

    addKeyValue(
      doc,
      "Правило",
      item.rule_code
    );

    addKeyValue(
      doc,
      "Домен",
      item.domain
    );

    addKeyValue(
      doc,
      "Результат",
      item.result
    );

    addKeyValue(
      doc,
      "Severity",
      item.severity
    );

    addKeyValue(
      doc,
      "Score",
      item.score
    );

    addKeyValue(
      doc,
      "Деталі",
      pdfAnalyticsDetailsSummary(
        item.details
      )
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    for (
      const url
      of item.evidence_urls
    ) {
      addUrl(
        doc,
        url
      );
    }

    doc.moveDown(
      0.45
    );
  }
}



function pdfLimitedText(
  value,
  maxLength = 1200
) {
  const normalized =
    valueOrNull(
      value
    );

  if (!normalized) {
    return null;
  }

  if (
    normalized.length <=
    maxLength
  ) {
    return normalized;
  }

  return `${
    normalized.slice(
      0,
      maxLength
    )
  }...`;
}


function addMentions(
  doc,
  content
) {
  addHeading(
    doc,
    `Медіа та веб-згадки - ${content.mentions.total}`
  );

  if (
    !content.mentions
      .items.length
  ) {
    addBullet(
      doc,
      "Релевантні згадки відсутні."
    );

    return;
  }

  for (
    let index = 0;
    index <
    content.mentions
      .items.length;
    index += 1
  ) {
    const item =
      content.mentions
        .items[index];

    ensureSpace(
      doc,
      175
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        `${index + 1}. ${
          item.title ||
          item.source ||
          "Згадка"
        }`
      );

    addKeyValue(
      doc,
      "Провайдер",
      item.provider
    );

    addKeyValue(
      doc,
      "Джерело",
      item.source
    );

    addKeyValue(
      doc,
      "Опубліковано",
      item.published_at
    );

    addKeyValue(
      doc,
      "Вперше зафіксовано",
      item.first_seen_at
    );

    addKeyValue(
      doc,
      "Match level",
      item.match_level
    );

    addKeyValue(
      doc,
      "Match score",
      item.match_score
    );

    addKeyValue(
      doc,
      "Підстави",
      item.reasons.join(
        "; "
      )
    );

    addKeyValue(
      doc,
      "Тип твердження",
      item.statement_type
    );

    const snippet =
      pdfLimitedText(
        item.snippet
      );

    if (snippet) {
      ensureSpace(
        doc,
        65
      );

      doc
        .font(
          "Regular"
        )
        .fontSize(
          9
        )
        .fillColor(
          COLORS.text
        )
        .text(
          snippet,
          {
            paragraphGap:
              4,
          }
        );
    }

    if (item.url) {
      addUrl(
        doc,
        item.url,
        "Відкрити матеріал"
      );
    }

    const evidenceUrls =
      [
        ...new Set(
          item.evidence_urls
            .filter(
              (url) =>
                url !==
                item.url
            )
        ),
      ];

    for (
      const url
      of evidenceUrls
    ) {
      addUrl(
        doc,
        url,
        "Evidence"
      );
    }

    doc.moveDown(
      0.6
    );
  }
}



function addSources(
  doc,
  content
) {
  addHeading(
    doc,
    `Каталог першоджерел - ${content.sources.length}`
  );

  if (!content.sources.length) {
    addBullet(
      doc,
      "Каталог першоджерел порожній."
    );

    return;
  }

  for (
    let index = 0;
    index <
    content.sources.length;
    index += 1
  ) {
    const item =
      content.sources[index];

    ensureSpace(
      doc,
      125
    );

    doc
      .font(
        "Bold"
      )
      .fontSize(
        10
      )
      .fillColor(
        COLORS.text
      )
      .text(
        `${index + 1}. ${
          item.title ||
          item.provider ||
          item.source_type ||
          "Джерело"
        }`
      );

    addKeyValue(
      doc,
      "Тип",
      item.source_type
    );

    addKeyValue(
      doc,
      "Провайдер",
      item.provider
    );

    addKeyValue(
      doc,
      "Опубліковано",
      item.published_at
    );

    addKeyValue(
      doc,
      "Зафіксовано",
      item.observed_at
    );

    if (item.url) {
      addUrl(
        doc,
        item.url
      );
    }

    doc.moveDown(
      0.55
    );
  }
}


function addAudit(
  doc,
  content
) {
  addHeading(
    doc,
    "Аудит snapshot"
  );

  addKeyValue(
    doc,
    "Версія досьє",
    content.audit
      .dossier_version_id
  );

  addKeyValue(
    doc,
    "Статус досьє",
    content.audit
      .dossier_status
  );

  addKeyValue(
    doc,
    "Report schema",
    content.audit
      .report_schema_version
  );

  addKeyValue(
    doc,
    "Report generated",
    content.audit
      .report_generated_at
  );

  addKeyValue(
    doc,
    "Payload hash",
    content.audit
      .payload_hash
  );

  addKeyValue(
    doc,
    "Hash algorithm",
    content.audit
      .payload_hash_version
  );

  addKeyValue(
    doc,
    "Snapshot created",
    content.audit
      .created_at
  );

  addKeyValue(
    doc,
    "PDF contract",
    content.audit
      .export_contract
  );
}


function addMethodology(
  doc,
  content
) {
  addHeading(
    doc,
    "Методологія"
  );

  const methodology =
    content.methodology;

  addKeyValue(
    doc,
    "Report model",
    methodology
      .report_model_version
  );

  addKeyValue(
    doc,
    "Analytics",
    methodology
      .analytics_version
  );

  addKeyValue(
    doc,
    "Rules",
    methodology
      .rules_version
  );

  addKeyValue(
    doc,
    "Analytical brief",
    methodology
      .analytical_brief_version
  );

  addKeyValue(
    doc,
    "Evidence policy",
    methodology
      .evidence_policy_version
  );

  addKeyValue(
    doc,
    "Manual review manifest",
    methodology
      .manual_review_manifest_version
  );

  if (
    methodology.notes
      .length
  ) {
    addHeading(
      doc,
      "Примітки",
      12
    );

    for (
      const item
      of methodology.notes
    ) {
      addBullet(
        doc,
        item
      );
    }
  }

  if (
    methodology
      .limitations
      .length
  ) {
    addHeading(
      doc,
      "Обмеження",
      12
    );

    for (
      const item
      of methodology
        .limitations
    ) {
      addBullet(
        doc,
        item
      );
    }
  }
}


function addFooters(
  doc
) {
  const range =
    doc.bufferedPageRange();

  for (
    let index = 0;
    index <
    range.count;
    index += 1
  ) {
    doc.switchToPage(
      range.start +
      index
    );

    const page =
      doc.page;

    const originalBottomMargin =
      page.margins.bottom;

    page.margins.bottom =
      0;

    doc
      .font(
        "Regular"
      )
      .fontSize(
        8
      )
      .fillColor(
        "#808080"
      )
      .text(
        `Person Monitor | Сторінка ${index + 1} з ${range.count}`,
        page.margins.left,
        page.height -
          28,
        {
          width:
            page.width -
            page.margins.left -
            page.margins.right,

          align:
            "center",

          lineBreak:
            false,
        }
      );

    page.margins.bottom =
      originalBottomMargin;
  }
}


export async function buildDossierPdf(
  inputModel
) {
  const model =
    requiredModel(
      inputModel
    );

  const content =
    buildDossierPdfContent(
      model
    );

  const generatedDate =
    safeDate(
      model.dossier
        ?.report_generated_at
    ) ??
    safeDate(
      model.dossier
        ?.created_at
    ) ??
    new Date(0);

  const buffer =
    await new Promise(
      (
        resolve,
        reject
      ) => {
        const doc =
          new PDFDocument({
            size:
              "A4",

            margins: {
              top:
                48,

              right:
                48,

              bottom:
                48,

              left:
                48,
            },

            bufferPages:
              true,

            info: {
              Title:
                `Аналітичне досьє: ${
                  content.subject
                    .full_name ??
                  ""
                }`,

              Author:
                "Person Monitor",

              Subject:
                "Canonical analytical dossier export",

              CreationDate:
                generatedDate,

              ModDate:
                generatedDate,
            },
          });

        const chunks =
          [];

        doc.on(
          "data",
          (chunk) =>
            chunks.push(
              chunk
            )
        );

        doc.on(
          "end",
          () =>
            resolve(
              Buffer.concat(
                chunks
              )
            )
        );

        doc.on(
          "error",
          reject
        );

        doc.registerFont(
          "Regular",
          PDF_FONTS.regular
        );

        doc.registerFont(
          "Bold",
          PDF_FONTS.bold
        );

        addCover(
          doc,
          content
        );

        addOverview(
          doc,
          content
        );

        addExecutiveSummary(
          doc,
          content
        );

        addCareerRelations(
          doc,
          content
        );

        addFinances(
          doc,
          content
        );

        addAssets(
          doc,
          content
        );

        addAnalytics(
          doc,
          content
        );

        addMentions(
          doc,
          content
        );

        addSources(
          doc,
          content
        );

        addAudit(
          doc,
          content
        );

        addMethodology(
          doc,
          content
        );

        addFooters(
          doc
        );

        doc.end();
      }
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
      DOSSIER_PDF_VERSION,

    contentType:
      DOSSIER_PDF_CONTENT_TYPE,

    filename:
      `${safeFilePart(
        model.subject
          ?.full_name
      )}_dossier_${versionPart}.pdf`,

    buffer,
  };
}
