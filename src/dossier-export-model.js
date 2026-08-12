export const DOSSIER_EXPORT_MODEL_VERSION =
  "dossier-export-model-v1";

const SECTION_KEYS =
  new Set([
    "meta",
    "subject",
    "identity",
    "declarations",
    "executive_summary",
    "career",
    "related_people",
    "relations",
    "income",
    "cash_assets",
    "real_estate",
    "vehicles",
    "analytics",
    "mentions",
    "sources",
    "methodology",
  ]);

function isRecord(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function textOrNull(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text || null;
}

function stringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(textOrNull)
    .filter(Boolean);
}

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function safeSource(source) {
  if (!isRecord(source)) {
    return null;
  }

  return {
    provider:
      textOrNull(
        source.provider
      ),

    source_type:
      textOrNull(
        source.source_type
      ),

    title:
      textOrNull(
        source.title
      ),

    url:
      textOrNull(
        source.url
      ),

    published_at:
      textOrNull(
        source.published_at
      ),

    observed_at:
      textOrNull(
        source.observed_at
      ),
  };
}

function sourceRows(report) {
  const raw =
    Array.isArray(
      report?.sources
    )
      ? report.sources
      : Array.isArray(
          report
            ?.sources
            ?.items
        )
        ? report.sources.items
        : [];

  return raw.filter(
    isRecord
  );
}

function buildSourceIndex(report) {
  const index =
    new Map();

  for (
    const source
    of sourceRows(report)
  ) {
    const id =
      textOrNull(
        source.source_document_id
      );

    if (!id) {
      continue;
    }

    const safe =
      safeSource(source);

    if (safe) {
      index.set(
        id,
        safe
      );
    }
  }

  return index;
}

function buildSourceCatalog(report) {
  return sourceRows(report)
    .map(safeSource)
    .filter(Boolean);
}

function safeEvidence(
  evidence,
  sourcesById
) {
  if (!Array.isArray(evidence)) {
    return [];
  }

  const seen =
    new Set();

  const result =
    [];

  for (
    const item
    of evidence
  ) {
    if (!isRecord(item)) {
      continue;
    }

    const sourceId =
      textOrNull(
        item.source_document_id
      );

    const source =
      sourceId
        ? sourcesById.get(
            sourceId
          )
        : null;

    if (!source) {
      continue;
    }

    const resolved = {
      ...source,

      statement_type:
        textOrNull(
          item.statement_type
        ) ??
        "source_fact",

      observed_at:
        textOrNull(
          item.observed_at
        ) ??
        source.observed_at,
    };

    const key =
      JSON.stringify(
        resolved
      );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(resolved);
  }

  return result;
}

function safeYear(value) {
  const number =
    Number(value);

  return Number.isInteger(number)
    ? number
    : null;
}

function safeCurrencyAmounts(
  value
) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(
        ([currency, amount]) => [
          textOrNull(currency),
          numberOrNull(amount),
        ]
      )
      .filter(
        ([currency, amount]) =>
          currency &&
          amount !== null
      )
  );
}

function safeLocation(value) {
  const source =
    isRecord(value)
      ? value
      : {};

  return {
    country:
      textOrNull(
        source.country
      ),

    region:
      textOrNull(
        source.region
      ),

    district:
      textOrNull(
        source.district
      ),

    city:
      textOrNull(
        source.city
      ),
  };
}

function safeIncomeSourceDetails(
  value
) {
  const source =
    isRecord(value)
      ? value
      : {};

  return {
    legal_entity_name:
      textOrNull(
        source.legal_entity_name
      ),

    legal_entity_code:
      textOrNull(
        source.legal_entity_code
      ),

    edrpou:
      textOrNull(
        source.edrpou
      ),

    foreign_company_name:
      textOrNull(
        source.foreign_company_name
      ),

    foreign_company_code:
      textOrNull(
        source.foreign_company_code
      ),

    person_name:
      textOrNull(
        source.person_name
      ),
  };
}

function safeAssetRights(
  value
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((right) => ({
      right_type:
        textOrNull(
          right.right_type
        ),

      ownership_percentage:
        numberOrNull(
          right.ownership_percentage
        ),

      percentage:
        numberOrNull(
          right.percentage
        ),

      share:
        textOrNull(
          right.share
        ),

      owner_role:
        textOrNull(
          right.owner_role
        ),

      owner_name:
        textOrNull(
          right.owner_name
        ),

      owner_relationship:
        textOrNull(
          right.owner_relationship
        ),
    }));
}

function buildIncome(
  report,
  sourcesById
) {
  const section =
    isRecord(report?.income)
      ? report.income
      : {};

  const yearly =
    Array.isArray(section.yearly)
      ? section.yearly
      : [];

  const sources =
    Array.isArray(section.sources)
      ? section.sources
      : [];

  return {
    yearly:
      yearly
        .filter(isRecord)
        .map((item) => ({
          year:
            safeYear(
              item.year
            ),

          declarant_uah:
            numberOrNull(
              item.declarant_uah
            ),

          family_uah:
            numberOrNull(
              item.family_uah
            ),

          household_uah:
            numberOrNull(
              item.household_uah
            ),

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            "calculation",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),

    sources:
      sources
        .filter(isRecord)
        .map((item) => ({
          year:
            safeYear(
              item.year
            ),

          recipient_role:
            textOrNull(
              item.recipient_role
            ),

          recipient_name:
            textOrNull(
              item.recipient_name
            ),

          recipient_relationship:
            textOrNull(
              item.recipient_relationship
            ),

          income_type:
            textOrNull(
              item.income_type
            ),

          other_income_type:
            textOrNull(
              item.other_income_type
            ),

          amount:
            numberOrNull(
              item.amount
            ),

          currency:
            textOrNull(
              item.currency
            ),

          source:
            textOrNull(
              item.source
            ),

          source_details:
            safeIncomeSourceDetails(
              item.source_details
            ),

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            "source_fact",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),
  };
}

function buildCashAssets(
  report,
  sourcesById
) {
  const section =
    isRecord(
      report?.cash_assets
    )
      ? report.cash_assets
      : {};

  const yearly =
    Array.isArray(section.yearly)
      ? section.yearly
      : [];

  return {
    yearly:
      yearly
        .filter(isRecord)
        .map((yearItem) => ({
          year:
            safeYear(
              yearItem.year
            ),

          declarant_by_currency:
            safeCurrencyAmounts(
              yearItem
                .declarant_by_currency
            ),

          household_by_currency:
            safeCurrencyAmounts(
              yearItem
                .household_by_currency
            ),

          items:
            (
              Array.isArray(
                yearItem.items
              )
                ? yearItem.items
                : []
            )
              .filter(isRecord)
              .map((item) => ({
                asset_type:
                  textOrNull(
                    item.asset_type
                  ),

                other_asset_type:
                  textOrNull(
                    item.other_asset_type
                  ),

                amount:
                  numberOrNull(
                    item.amount
                  ),

                currency:
                  textOrNull(
                    item.currency
                  ),

                organization_type:
                  textOrNull(
                    item.organization_type
                  ),

                organization_name:
                  textOrNull(
                    item.organization_name
                  ),

                owner_role:
                  textOrNull(
                    item.owner_role
                  ),

                owner_name:
                  textOrNull(
                    item.owner_name
                  ),

                owner_relationship:
                  textOrNull(
                    item.owner_relationship
                  ),

                rights:
                  safeAssetRights(
                    item.rights
                  ),

                statement_type:
                  textOrNull(
                    item.statement_type
                  ) ??
                  "source_fact",

                evidence:
                  safeEvidence(
                    item.evidence,
                    sourcesById
                  ),
              })),

          evidence:
            safeEvidence(
              yearItem.evidence,
              sourcesById
            ),
        })),
  };
}

function buildRealEstate(
  report,
  sourcesById
) {
  const section =
    isRecord(
      report?.real_estate
    )
      ? report.real_estate
      : {};

  const yearly =
    Array.isArray(section.yearly)
      ? section.yearly
      : [];

  return {
    yearly:
      yearly
        .filter(isRecord)
        .map((yearItem) => ({
          year:
            safeYear(
              yearItem.year
            ),

          items:
            (
              Array.isArray(
                yearItem.items
              )
                ? yearItem.items
                : []
            )
              .filter(isRecord)
              .map((item) => ({
                object_type:
                  textOrNull(
                    item.object_type
                  ),

                other_object_type:
                  textOrNull(
                    item.other_object_type
                  ),

                area:
                  numberOrNull(
                    item.area
                  ),

                area_unit:
                  textOrNull(
                    item.area_unit
                  ),

                location:
                  safeLocation(
                    item.location
                  ),

                acquisition_date:
                  textOrNull(
                    item.acquisition_date
                  ),

                cost:
                  numberOrNull(
                    item.cost
                  ),

                owner_role:
                  textOrNull(
                    item.owner_role
                  ),

                owner_name:
                  textOrNull(
                    item.owner_name
                  ),

                owner_relationship:
                  textOrNull(
                    item.owner_relationship
                  ),

                rights:
                  safeAssetRights(
                    item.rights
                  ),

                statement_type:
                  textOrNull(
                    item.statement_type
                  ) ??
                  "source_fact",

                evidence:
                  safeEvidence(
                    item.evidence,
                    sourcesById
                  ),
              })),

          evidence:
            safeEvidence(
              yearItem.evidence,
              sourcesById
            ),
        })),
  };
}

function buildVehicles(
  report,
  sourcesById
) {
  const section =
    isRecord(report?.vehicles)
      ? report.vehicles
      : {};

  const yearly =
    Array.isArray(section.yearly)
      ? section.yearly
      : [];

  return {
    yearly:
      yearly
        .filter(isRecord)
        .map((yearItem) => ({
          year:
            safeYear(
              yearItem.year
            ),

          items:
            (
              Array.isArray(
                yearItem.items
              )
                ? yearItem.items
                : []
            )
              .filter(isRecord)
              .map((item) => ({
                object_type:
                  textOrNull(
                    item.object_type
                  ),

                other_object_type:
                  textOrNull(
                    item.other_object_type
                  ),

                brand:
                  textOrNull(
                    item.brand
                  ),

                model:
                  textOrNull(
                    item.model
                  ),

                production_year:
                  safeYear(
                    item.production_year
                  ),

                acquisition_date:
                  textOrNull(
                    item.acquisition_date
                  ),

                cost:
                  numberOrNull(
                    item.cost
                  ),

                owner_role:
                  textOrNull(
                    item.owner_role
                  ),

                owner_name:
                  textOrNull(
                    item.owner_name
                  ),

                owner_relationship:
                  textOrNull(
                    item.owner_relationship
                  ),

                rights:
                  safeAssetRights(
                    item.rights
                  ),

                statement_type:
                  textOrNull(
                    item.statement_type
                  ) ??
                  "source_fact",

                evidence:
                  safeEvidence(
                    item.evidence,
                    sourcesById
                  ),
              })),

          evidence:
            safeEvidence(
              yearItem.evidence,
              sourcesById
            ),
        })),
  };
}

function booleanOrNull(value) {
  return typeof value === "boolean"
    ? value
    : null;
}

function safeAnalyticsDetails(
  value
) {
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
        (key) =>
          source[key] !== null &&
          source[key] !== undefined
      )
      .map(
        (key) => [
          key,
          source[key],
        ]
      )
  );
}

function buildAnalytics(
  report,
  sourcesById
) {
  const section =
    isRecord(report?.analytics)
      ? report.analytics
      : {};

  const metrics =
    Array.isArray(section.metrics)
      ? section.metrics
      : [];

  const transitions =
    Array.isArray(
      section.transitions
    )
      ? section.transitions
      : [];

  const findings =
    Array.isArray(section.findings)
      ? section.findings
      : [];

  return {
    metrics:
      metrics
        .filter(isRecord)
        .map((item) => ({
          year:
            safeYear(
              item.year
            ),

          income_declarant_uah:
            numberOrNull(
              item
                .income_declarant_uah
            ),

          income_household_uah:
            numberOrNull(
              item
                .income_household_uah
            ),

          cash_declarant_by_currency:
            safeCurrencyAmounts(
              item
                .cash_declarant_by_currency
            ),

          cash_household_by_currency:
            safeCurrencyAmounts(
              item
                .cash_household_by_currency
            ),

          real_estate_items:
            numberOrNull(
              item.real_estate_items
            ),

          vehicle_items:
            numberOrNull(
              item.vehicle_items
            ),

          relation_count:
            numberOrNull(
              item.relation_count
            ),

          career: {
            organization:
              textOrNull(
                item.career
                  ?.organization
              ),

            position:
              textOrNull(
                item.career
                  ?.position
              ),
          },

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            "calculation",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),

    transitions:
      transitions
        .filter(isRecord)
        .map((item) => ({
          from_year:
            safeYear(
              item.from_year
            ),

          to_year:
            safeYear(
              item.to_year
            ),

          year_gap:
            numberOrNull(
              item.year_gap
            ),

          income_delta_uah:
            numberOrNull(
              item.income_delta_uah
            ),

          income_delta_percent:
            numberOrNull(
              item
                .income_delta_percent
            ),

          cash_uah_delta:
            numberOrNull(
              item.cash_uah_delta
            ),

          real_estate_count_delta:
            numberOrNull(
              item
                .real_estate_count_delta
            ),

          vehicle_count_delta:
            numberOrNull(
              item
                .vehicle_count_delta
            ),

          organization_changed:
            booleanOrNull(
              item
                .organization_changed
            ),

          position_changed:
            booleanOrNull(
              item.position_changed
            ),

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            "calculation",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),

    findings:
      findings
        .filter(isRecord)
        .map((item) => ({
          rule_code:
            textOrNull(
              item.rule_code
            ),

          domain:
            textOrNull(
              item.domain
            ),

          result:
            textOrNull(
              item.result
            ),

          severity:
            textOrNull(
              item.severity
            ),

          score:
            numberOrNull(
              item.score
            ),

          message:
            textOrNull(
              item.message
            ),

          details:
            safeAnalyticsDetails(
              item.details
            ),

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            "heuristic_signal",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),
  };
}

function buildMentions(
  report,
  sourcesById
) {
  const section =
    isRecord(report?.mentions)
      ? report.mentions
      : {};

  const rows =
    Array.isArray(section.items)
      ? section.items
      : [];

  const items =
    rows
      .filter(isRecord)
      .map((item) => ({
        provider:
          textOrNull(
            item.provider
          ),

        source:
          textOrNull(
            item.source
          ),

        title:
          textOrNull(
            item.title
          ),

        snippet:
          textOrNull(
            item.snippet
          ),

        url:
          textOrNull(
            item.url
          ),

        published_at:
          textOrNull(
            item.published_at
          ),

        first_seen_at:
          textOrNull(
            item.first_seen_at
          ),

        match_score:
          numberOrNull(
            item.match_score
          ),

        match_level:
          textOrNull(
            item.match_level
          ),

        reasons:
          stringList(
            item.reasons
          ),

        statement_type:
          "source_fact",

        evidence:
          safeEvidence(
            item.source_document_id
              ? [{
                  source_document_id:
                    item
                      .source_document_id,

                  statement_type:
                    "source_fact",
                }]
              : [],
            sourcesById
          ),
      }));

  return {
    total:
      numberOrNull(
        section.total
      ) ??
      items.length,

    items,
  };
}

function buildCareer(
  report,
  sourcesById
) {
  const section =
    isRecord(report?.career)
      ? report.career
      : {};

  const items =
    Array.isArray(section.items)
      ? section.items
      : [];

  const transitions =
    Array.isArray(section.transitions)
      ? section.transitions
      : [];

  return {
    items:
      items
        .filter(isRecord)
        .map((item) => ({
          year:
            safeYear(
              item.year
            ),

          organization:
            textOrNull(
              item.organization
            ),

          position:
            textOrNull(
              item.position
            ),

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            "source_fact",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),

    transitions:
      transitions
        .filter(isRecord)
        .map((item) => ({
          from_year:
            safeYear(
              item.from_year
            ),

          to_year:
            safeYear(
              item.to_year
            ),

          organization_changed:
            typeof item
              .organization_changed ===
              "boolean"
              ? item
                  .organization_changed
              : null,

          position_changed:
            typeof item
              .position_changed ===
              "boolean"
              ? item
                  .position_changed
              : null,

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            "calculation",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),
  };
}

function buildRelatedPeople(
  report,
  sourcesById
) {
  const section =
    isRecord(
      report?.related_people
    )
      ? report.related_people
      : {};

  const items =
    Array.isArray(section.items)
      ? section.items
      : [];

  return {
    items:
      items
        .filter(isRecord)
        .map((item) => ({
          full_name:
            textOrNull(
              item.full_name
            ),

          relation_type:
            textOrNull(
              item.relation_type
            ),

          role:
            textOrNull(
              item.role
            ),

          relationship:
            textOrNull(
              item.relationship
            ),

          years:
            Array.isArray(
              item.years
            )
              ? item.years
                  .map(safeYear)
                  .filter(
                    (year) =>
                      year !== null
                  )
              : [],

          identity_status:
            textOrNull(
              item.identity_status
            ),

          review_required:
            item.review_required ===
              true,

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            "source_fact",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),
  };
}

function buildRelations(
  report,
  sourcesById
) {
  const section =
    isRecord(
      report?.relations
    )
      ? report.relations
      : {};

  const items =
    Array.isArray(section.items)
      ? section.items
      : [];

  return {
    items:
      items
        .filter(isRecord)
        .map((item) => ({
          relation_type:
            textOrNull(
              item.relation_type
            ),

          relation_scope:
            textOrNull(
              item.relation_scope
            ),

          label:
            textOrNull(
              item.label
            ),

          from_entity_type:
            textOrNull(
              item.from_entity_type
            ),

          from_name:
            textOrNull(
              item.from_name
            ),

          to_entity_type:
            textOrNull(
              item.to_entity_type
            ),

          to_name:
            textOrNull(
              item.to_name
            ),

          year:
            safeYear(
              item.year
            ),

          confidence:
            numberOrNull(
              item.confidence
            ),

          verification_status:
            textOrNull(
              item.verification_status
            ),

          source:
            textOrNull(
              item.metadata
                ?.source
            ),

          relation_semantics:
            textOrNull(
              item.metadata
                ?.relation_semantics
            ),

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            (
              item.relation_scope ===
                "timeless"
                ? "heuristic_signal"
                : "source_fact"
            ),

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),
  };
}

function buildExecutiveSummary(
  report,
  sourcesById
) {
  const section =
    isRecord(
      report
        ?.executive_summary
    )
      ? report
          .executive_summary
      : {};

  const items =
    Array.isArray(
      section.items
    )
      ? section.items
      : [];

  return {
    status:
      textOrNull(
        section.status
      ),

    items:
      items
        .filter(isRecord)
        .map((item) => ({
          rule_code:
            textOrNull(
              item.rule_code
            ),

          domain:
            textOrNull(
              item.domain
            ),

          result:
            textOrNull(
              item.result
            ),

          severity:
            textOrNull(
              item.severity
            ),

          score:
            numberOrNull(
              item.score
            ),

          message:
            textOrNull(
              item.message
            ),

          statement_type:
            textOrNull(
              item.statement_type
            ) ??
            "heuristic_signal",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),
  };
}

function buildBriefManifest(
  report
) {
  const brief =
    isRecord(
      report
        ?.analytical_brief
    )
      ? report
          .analytical_brief
      : {};

  const sections =
    Array.isArray(
      brief.sections
    )
      ? brief.sections
      : [];

  return {
    version:
      textOrNull(
        brief.version
      ),

    sections:
      sections
        .filter(isRecord)
        .map((section) => ({
          code:
            textOrNull(
              section.code
            ),

          title:
            textOrNull(
              section.title
            ),

          source_paths:
            Array.isArray(
              section.source_paths
            )
              ? section
                  .source_paths
                  .map(
                    textOrNull
                  )
                  .filter(
                    (path) =>
                      path &&
                      SECTION_KEYS.has(
                        path
                      )
                  )
              : [],
        }))
        .filter(
          (section) =>
            section.code ||
            section.title ||
            section
              .source_paths
              .length
        ),
  };
}

function buildMethodology(
  report
) {
  const methodology =
    isRecord(
      report?.methodology
    )
      ? report.methodology
      : {};

  return {
    report_model_version:
      textOrNull(
        methodology
          .report_model_version
      ),

    analytics_version:
      textOrNull(
        methodology
          .analytics_version
      ),

    rules_version:
      textOrNull(
        methodology
          .rules_version
      ),

    analytical_brief_version:
      textOrNull(
        methodology
          .analytical_brief_version
      ),

    evidence_policy_version:
      textOrNull(
        methodology
          .evidence_policy_version
      ),

    manual_review_manifest_version:
      textOrNull(
        methodology
          .manual_review_manifest_version
      ),

    notes:
      stringList(
        methodology.notes
      ),

    limitations:
      stringList(
        methodology.limitations
      ),
  };
}

function primitiveTextList(
  value
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        typeof item === "string" ||
        typeof item === "number"
    )
    .map(textOrNull)
    .filter(Boolean);
}

function buildMeta(report) {
  const meta =
    isRecord(report?.meta)
      ? report.meta
      : {};

  return {
    schema_version:
      textOrNull(
        meta.schema_version
      ),

    analytics_version:
      textOrNull(
        meta.analytics_version
      ),

    period: {
      from_year:
        safeYear(
          meta.period?.from_year
        ),

      to_year:
        safeYear(
          meta.period?.to_year
        ),
    },

    available_years:
      (
        Array.isArray(
          meta.available_years
        )
          ? meta.available_years
          : []
      )
        .map(safeYear)
        .filter(
          (year) =>
            year !== null
        ),

    freshness:
      primitiveTextList(
        meta.freshness
      ),
  };
}

function buildIdentity(report) {
  const identity =
    isRecord(report?.identity)
      ? report.identity
      : {};

  return {
    resolution_status:
      textOrNull(
        identity.resolution_status
      ),

    score:
      numberOrNull(
        identity.score
      ),

    hard_match:
      booleanOrNull(
        identity.hard_match
      ),

    review_required:
      booleanOrNull(
        identity.review_required
      ),

    identifiers:
      primitiveTextList(
        identity.identifiers
      ),

    aliases:
      primitiveTextList(
        identity.aliases
      ),

    reasons:
      primitiveTextList(
        identity.reasons
      ),
  };
}

function buildDeclarations(
  report,
  sourcesById
) {
  const section =
    isRecord(
      report?.declarations
    )
      ? report.declarations
      : {};

  const items =
    Array.isArray(section.items)
      ? section.items
      : [];

  return {
    available_years:
      (
        Array.isArray(
          section.available_years
        )
          ? section.available_years
          : []
      )
        .map(safeYear)
        .filter(
          (year) =>
            year !== null
        ),

    items:
      items
        .filter(isRecord)
        .map((item) => ({
          year:
            safeYear(
              item.year
            ),

          document_guid:
            textOrNull(
              item.document_guid
            ),

          registry:
            textOrNull(
              item.registry
            ),

          published_at:
            textOrNull(
              item.published_at
            ),

          source_url:
            textOrNull(
              item.source_url
            ),

          canonical:
            booleanOrNull(
              item.canonical
            ),

          statement_type:
            "source_fact",

          evidence:
            safeEvidence(
              item.evidence,
              sourcesById
            ),
        })),
  };
}

function buildSubject(report) {
  const subject =
    isRecord(
      report?.subject
    )
      ? report.subject
      : {};

  return {
    full_name:
      textOrNull(
        subject.full_name
      ),

    position:
      textOrNull(
        subject.position
      ),

    organization:
      textOrNull(
        subject.organization
      ),

    city:
      textOrNull(
        subject.city
      ),

    status:
      textOrNull(
        subject.status
      ),
  };
}

export function buildDossierExportModel(
  input
) {
  if (!isRecord(input)) {
    throw new TypeError(
      "dossier export input is required"
    );
  }

  const report =
    input.report;

  if (!isRecord(report)) {
    throw new TypeError(
      "canonical report is required"
    );
  }

  const sourcesById =
    buildSourceIndex(
      report
    );

  return {
    contract_version:
      DOSSIER_EXPORT_MODEL_VERSION,

    dossier: {
      version_id:
        textOrNull(
          input
            .dossier_version_id
        ),

      status:
        textOrNull(
          input
            .dossier_status
        ),

      report_schema_version:
        textOrNull(
          input
            .report_schema_version
        ),

      report_generated_at:
        textOrNull(
          input
            .report_generated_at
        ),

      payload_hash:
        textOrNull(
          input
            .report_payload_hash
        ),

      payload_hash_version:
        textOrNull(
          input
            .report_payload_hash_version
        ),

      created_at:
        textOrNull(
          input.created_at
        ),
    },

    meta:
      buildMeta(
        report
      ),

    subject:
      buildSubject(
        report
      ),

    identity:
      buildIdentity(
        report
      ),

    declarations:
      buildDeclarations(
        report,
        sourcesById
      ),

    brief:
      buildBriefManifest(
        report
      ),

    executive_summary:
      buildExecutiveSummary(
        report,
        sourcesById
      ),

    income:
      buildIncome(
        report,
        sourcesById
      ),

    cash_assets:
      buildCashAssets(
        report,
        sourcesById
      ),

    real_estate:
      buildRealEstate(
        report,
        sourcesById
      ),

    vehicles:
      buildVehicles(
        report,
        sourcesById
      ),

    career:
      buildCareer(
        report,
        sourcesById
      ),

    related_people:
      buildRelatedPeople(
        report,
        sourcesById
      ),

    relations:
      buildRelations(
        report,
        sourcesById
      ),

    analytics:
      buildAnalytics(
        report,
        sourcesById
      ),

    mentions:
      buildMentions(
        report,
        sourcesById
      ),

    methodology:
      buildMethodology(
        report
      ),

    sources:
      buildSourceCatalog(
        report
      ),
  };
}
