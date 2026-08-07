import { db } from "./db.js";
import { stableFingerprint } from "./utils.js";

const ANALYTICS_VERSION = "annual-v1";

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function roleOf(fact) {
  return fact?.value_json?.person?.role ?? null;
}

function isHouseholdRole(role) {
  return role === "declarant" || role === "family";
}

function hasDeclarantRight(fact) {
  const rights = fact?.value_json?.rights;

  if (!Array.isArray(rights)) {
    return false;
  }

  return rights.some(
    (right) =>
      right?.actor?.role === "declarant",
  );
}

function isDeclarantRelated(fact) {
  return (
    roleOf(fact) === "declarant" ||
    hasDeclarantRight(fact)
  );
}

function addCurrency(target, currency, amount) {
  const key = String(currency ?? "")
    .trim()
    .toUpperCase();

  if (!key) {
    return;
  }

  target[key] =
    round(
      number(target[key]) +
      number(amount),
    );
}

function percentageDelta(previous, current) {
  const before = number(previous);
  const after = number(current);

  if (before === 0) {
    return null;
  }

  return round(
    ((after - before) / Math.abs(before)) *
      100,
  );
}

export function computeYearMetrics(
  facts,
  context = {},
) {
  const metrics = {
    year: context.year ?? null,

    sourceDocumentId:
      context.sourceDocumentId ?? null,

    publishedAt:
      context.publishedAt ?? null,

    incomeDeclarantUah: 0,
    incomeHouseholdUah: 0,

    cashDeclarantByCurrency: {},
    cashHouseholdByCurrency: {},

    realEstateDeclared: 0,
    realEstateDeclarantRelated: 0,

    vehiclesDeclared: 0,
    vehiclesDeclarantRelated: 0,

    familyMembers: 0,

    employment: {
      workplace: null,
      position: null,
    },

    factsCount: facts.length,
  };

  for (const fact of facts) {
    const type = fact.fact_type;
    const role = roleOf(fact);

    if (type === "income") {
      const amount =
        number(fact.value_number);

      const currency =
        String(fact.unit ?? "UAH")
          .toUpperCase();

      if (
        role === "declarant" &&
        currency === "UAH"
      ) {
        metrics.incomeDeclarantUah +=
          amount;
      }

      if (
        isHouseholdRole(role) &&
        currency === "UAH"
      ) {
        metrics.incomeHouseholdUah +=
          amount;
      }
    }

    if (type === "cash_asset") {
      if (role === "declarant") {
        addCurrency(
          metrics.cashDeclarantByCurrency,
          fact.unit,
          fact.value_number,
        );
      }

      if (isHouseholdRole(role)) {
        addCurrency(
          metrics.cashHouseholdByCurrency,
          fact.unit,
          fact.value_number,
        );
      }
    }

    if (type === "real_estate") {
      metrics.realEstateDeclared += 1;

      if (isDeclarantRelated(fact)) {
        metrics.realEstateDeclarantRelated +=
          1;
      }
    }

    if (type === "vehicle") {
      metrics.vehiclesDeclared += 1;

      if (isDeclarantRelated(fact)) {
        metrics.vehiclesDeclarantRelated +=
          1;
      }
    }

    if (type === "family_member") {
      metrics.familyMembers += 1;
    }

    if (type === "employment") {
      metrics.employment = {
        workplace:
          fact.value_json?.workplace ??
          null,

        position:
          fact.value_json?.position ??
          fact.value_text ??
          null,
      };
    }
  }

  metrics.incomeDeclarantUah =
    round(metrics.incomeDeclarantUah);

  metrics.incomeHouseholdUah =
    round(metrics.incomeHouseholdUah);

  return metrics;
}

export function compareYearMetrics(
  previous,
  current,
) {
  const yearGap =
    number(current.year) -
    number(previous.year);

  const previousCashUah =
    number(
      previous
        .cashDeclarantByCurrency
        ?.UAH,
    );

  const currentCashUah =
    number(
      current
        .cashDeclarantByCurrency
        ?.UAH,
    );

  const cashUahDelta =
    round(
      currentCashUah -
      previousCashUah,
    );

  const incomeDelta =
    round(
      current.incomeDeclarantUah -
      previous.incomeDeclarantUah,
    );

  const incomeDeltaPercent =
    percentageDelta(
      previous.incomeDeclarantUah,
      current.incomeDeclarantUah,
    );

  const realEstateDelta =
    current.realEstateDeclarantRelated -
    previous.realEstateDeclarantRelated;

  const vehicleDelta =
    current.vehiclesDeclarantRelated -
    previous.vehiclesDeclarantRelated;

  const findings = [];

  /*
   * Heuristic only.
   * Growth of UAH cash is compared with declared
   * income for the same year.
   *
   * This does NOT prove unexplained wealth:
   * sales, conversions, prior savings and other
   * lawful sources may explain the change.
   */
  if (
    yearGap === 1 &&
    cashUahDelta > 0 &&
    current.incomeDeclarantUah > 0
  ) {
    const ratio =
      cashUahDelta /
      current.incomeDeclarantUah;

    if (ratio >= 0.75) {
      findings.push({
        checkType:
          "financial_dynamics",

        ruleCode:
          "AN_CASH_UAH_GROWTH_V1",

        result: "review",

        score:
          Math.min(
            100,
            Math.round(
              50 + ratio * 25,
            ),
          ),

        message:
          "Приріст задекларованих грошових активів у UAH є значним порівняно із задекларованим доходом за рік. Потрібна контекстна перевірка джерел зміни.",

        details: {
          cash_uah_delta:
            cashUahDelta,

          current_income_uah:
            current.incomeDeclarantUah,

          ratio:
            round(ratio, 4),
        },
      });
    }
  }

  if (
    yearGap === 1 &&
    incomeDeltaPercent !== null &&
    Math.abs(incomeDeltaPercent) >= 50
  ) {
    findings.push({
      checkType:
        "financial_dynamics",

      ruleCode:
        "AN_INCOME_CHANGE_V1",

      result: "change",

      score:
        Math.min(
          100,
          Math.round(
            50 +
            Math.abs(
              incomeDeltaPercent,
            ) / 2,
          ),
        ),

      message:
        "Задекларований дохід декларанта змінився на 50% або більше порівняно з попереднім роком.",

      details: {
        income_delta:
          incomeDelta,

        income_delta_percent:
          incomeDeltaPercent,
      },
    });
  }

  if (realEstateDelta !== 0) {
    findings.push({
      checkType:
        "asset_dynamics",

      ruleCode:
        "AN_REAL_ESTATE_COUNT_V1",

      result: "change",

      score:
        Math.min(
          100,
          50 +
          Math.abs(
            realEstateDelta,
          ) * 10,
        ),

      message:
        "Змінилася кількість об’єктів нерухомості, пов’язаних із декларантом.",

      details: {
        count_delta:
          realEstateDelta,

        previous_count:
          previous
            .realEstateDeclarantRelated,

        current_count:
          current
            .realEstateDeclarantRelated,

        year_gap: yearGap,
      },
    });
  }

  if (vehicleDelta !== 0) {
    findings.push({
      checkType:
        "asset_dynamics",

      ruleCode:
        "AN_VEHICLE_COUNT_V1",

      result: "change",

      score:
        Math.min(
          100,
          50 +
          Math.abs(
            vehicleDelta,
          ) * 10,
        ),

      message:
        "Змінилася кількість транспортних засобів, пов’язаних із декларантом.",

      details: {
        count_delta:
          vehicleDelta,

        previous_count:
          previous
            .vehiclesDeclarantRelated,

        current_count:
          current
            .vehiclesDeclarantRelated,

        year_gap: yearGap,
      },
    });
  }

  const previousPosition =
    previous.employment?.position ??
    null;

  const currentPosition =
    current.employment?.position ??
    null;

  const previousWorkplace =
    previous.employment?.workplace ??
    null;

  const currentWorkplace =
    current.employment?.workplace ??
    null;

  if (
    previousPosition &&
    currentPosition &&
    (
      previousPosition !==
        currentPosition ||
      previousWorkplace !==
        currentWorkplace
    )
  ) {
    findings.push({
      checkType:
        "career_dynamics",

      ruleCode:
        "AN_EMPLOYMENT_CHANGE_V1",

      result: "change",

      score: 50,

      message:
        "У деклараціях зафіксовано зміну посади або місця роботи.",

      details: {
        previous: {
          workplace:
            previousWorkplace,

          position:
            previousPosition,
        },

        current: {
          workplace:
            currentWorkplace,

          position:
            currentPosition,
        },

        year_gap: yearGap,
      },
    });
  }

  return {
    fromYear:
      previous.year,

    toYear:
      current.year,

    yearGap,

    incomeDelta,
    incomeDeltaPercent,

    cashUahDelta,

    realEstateDelta,
    vehicleDelta,

    findings,
  };
}

export async function buildEntityAnalytics(
  entityId,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const entityRows =
    await sql`
      SELECT
        id,
        canonical_name
      FROM entities
      WHERE id = ${entityId}
      LIMIT 1
    `;

  if (!entityRows.length) {
    throw new Error(
      `Entity not found: ${entityId}`,
    );
  }

  const rows =
    await sql`
      WITH ranked AS (
        SELECT
          f.entity_id,

          (
            f.value_json
            ->> 'declaration_year'
          )::int
            AS year,

          f.source_document_id,

          (
            f.value_json
            ->> 'published_at'
          )::timestamptz
            AS published_at,

          row_number() OVER (
            PARTITION BY
              f.entity_id,
              (
                f.value_json
                ->> 'declaration_year'
              )::int

            ORDER BY
              (
                f.value_json
                ->> 'published_at'
              )::timestamptz
                DESC NULLS LAST,

              f.created_at DESC
          ) AS rn

        FROM facts f

        WHERE
          f.entity_id =
            ${entityId}

          AND f.fact_type =
            'declaration_submission'
      ),

      latest AS (
        SELECT
          entity_id,
          year,
          source_document_id,
          published_at

        FROM ranked

        WHERE rn = 1
      )

      SELECT
        l.year,
        l.source_document_id,
        l.published_at,

        f.fact_type,
        f.value_text,
        f.value_number,
        f.value_json,
        f.unit

      FROM latest l

      LEFT JOIN facts f
        ON f.entity_id =
           l.entity_id

       AND f.source_document_id =
           l.source_document_id

       AND f.fact_type IN (
         'employment',
         'family_member',
         'real_estate',
         'vehicle',
         'income',
         'cash_asset'
       )

      ORDER BY
        l.year ASC,
        f.fact_type ASC,
        f.id ASC
    `;

  const years =
    new Map();

  for (const row of rows) {
    if (!years.has(row.year)) {
      years.set(
        row.year,
        {
          year:
            row.year,

          sourceDocumentId:
            row.source_document_id,

          publishedAt:
            row.published_at,

          facts: [],
        },
      );
    }

    if (row.fact_type) {
      years.get(
        row.year,
      ).facts.push(row);
    }
  }

  const yearly =
    [...years.values()]
      .sort(
        (a, b) =>
          a.year - b.year,
      )
      .map((item) =>
        computeYearMetrics(
          item.facts,
          item,
        ),
      );

  const transitions = [];

  for (
    let index = 1;
    index < yearly.length;
    index += 1
  ) {
    transitions.push(
      compareYearMetrics(
        yearly[index - 1],
        yearly[index],
      ),
    );
  }

  return {
    entityId:
      entityRows[0].id,

    canonicalName:
      entityRows[0]
        .canonical_name,

    analyticsVersion:
      ANALYTICS_VERSION,

    yearly,
    transitions,
  };
}

export async function buildAllAnalytics(
  options = {},
) {
  const sql =
    options.sql ?? db();

  const entities =
    await sql`
      SELECT id
      FROM entities
      WHERE
        entity_type = 'person'
        AND status = 'active'
      ORDER BY canonical_name
    `;

  const result = [];

  for (const entity of entities) {
    result.push(
      await buildEntityAnalytics(
        entity.id,
        { sql },
      ),
    );
  }

  return result;
}

export async function persistAnalyticsCrossChecks(
  analytics,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const stats = {
    inserted: 0,
    updated: 0,
  };

  for (
    const transition
    of analytics.transitions
  ) {
    const previous =
      analytics.yearly.find(
        (item) =>
          item.year ===
          transition.fromYear,
      );

    const current =
      analytics.yearly.find(
        (item) =>
          item.year ===
          transition.toYear,
      );

    for (
      const finding
      of transition.findings
    ) {
      const checkKey =
        stableFingerprint(
          ANALYTICS_VERSION,
          analytics.entityId,
          transition.fromYear,
          transition.toYear,
          finding.ruleCode,
        );

      const details = {
        check_key:
          checkKey,

        analytics_version:
          ANALYTICS_VERSION,

        from_year:
          transition.fromYear,

        to_year:
          transition.toYear,

        message:
          finding.message,

        metrics:
          finding.details,
      };

      const existing =
        await sql`
          SELECT id
          FROM cross_checks

          WHERE
            entity_id =
              ${analytics.entityId}

            AND check_type =
              ${finding.checkType}

            AND rule_code =
              ${finding.ruleCode}

            AND details
              ->> 'check_key'
              = ${checkKey}

          LIMIT 1
        `;

      if (existing.length) {
        await sql`
          UPDATE cross_checks

          SET
            left_source_document_id =
              ${previous?.sourceDocumentId ?? null},

            right_source_document_id =
              ${current?.sourceDocumentId ?? null},

            result =
              ${finding.result},

            score =
              ${finding.score},

            details =
              ${JSON.stringify(
                details,
              )}::jsonb

          WHERE id =
            ${existing[0].id}
        `;

        stats.updated += 1;
        continue;
      }

      await sql`
        INSERT INTO cross_checks (
          entity_id,
          check_type,
          rule_code,

          left_source_document_id,
          right_source_document_id,

          result,
          score,
          details
        )

        VALUES (
          ${analytics.entityId},
          ${finding.checkType},
          ${finding.ruleCode},

          ${previous?.sourceDocumentId ?? null},
          ${current?.sourceDocumentId ?? null},

          ${finding.result},
          ${finding.score},

          ${JSON.stringify(
            details,
          )}::jsonb
        )
      `;

      stats.inserted += 1;
    }
  }

  return stats;
}
