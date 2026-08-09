import { db } from "./db.js";

export async function loadDeterministicIncomeAnalyticsContext(
  entityId,
  year,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const normalizedYear =
    Number(year);

  if (
    !entityId ||
    !Number.isInteger(
      normalizedYear
    )
  ) {
    return null;
  }

  const rows =
    await sql`
      WITH canonical AS (
        SELECT
          f.source_document_id

        FROM facts f

        WHERE
          f.entity_id =
            ${entityId}

          AND f.fact_type =
            'declaration_submission'

          AND (
            f.value_json
            ->> 'declaration_year'
          )::int =
            ${normalizedYear}

        ORDER BY
          (
            f.value_json
            ->> 'published_at'
          )::timestamptz
            DESC NULLS LAST,

          f.created_at DESC

        LIMIT 1
      )

      SELECT
        c.source_document_id
          AS source_document_id,

        sd.url
          AS source_url,

        COALESCE(
          SUM(
            CASE
              WHEN
                UPPER(
                  COALESCE(
                    i.unit,
                    'UAH'
                  )
                ) = 'UAH'

                AND (
                  i.value_json
                  -> 'person'
                  ->> 'role'
                ) = 'declarant'

              THEN
                COALESCE(
                  i.value_number,
                  0
                )

              ELSE 0
            END
          ),
          0
        ) AS income_declarant_uah,

        COALESCE(
          SUM(
            CASE
              WHEN
                UPPER(
                  COALESCE(
                    i.unit,
                    'UAH'
                  )
                ) = 'UAH'

                AND (
                  i.value_json
                  -> 'person'
                  ->> 'role'
                ) IN (
                  'declarant',
                  'family'
                )

              THEN
                COALESCE(
                  i.value_number,
                  0
                )

              ELSE 0
            END
          ),
          0
        ) AS income_household_uah,

        COUNT(i.id)::int
          AS income_fact_count

      FROM canonical c

      LEFT JOIN source_documents sd
        ON sd.id =
           c.source_document_id

      LEFT JOIN facts i
        ON i.entity_id =
           ${entityId}

       AND i.source_document_id =
           c.source_document_id

       AND i.fact_type =
           'income'

      GROUP BY
        c.source_document_id,
        sd.url
    `;

  if (!rows.length) {
    return null;
  }

  const row =
    rows[0];

  const sourceDocumentId =
    row
      ?.source_document_id ??
    null;

  if (!sourceDocumentId) {
    return null;
  }

  const incomeDeclarantUah =
    Number(
      row
        ?.income_declarant_uah ??
      0
    );

  const incomeHouseholdUah =
    Number(
      row
        ?.income_household_uah ??
      0
    );

  const incomeFactCount =
    Number(
      row
        ?.income_fact_count ??
      0
    );

  return {
    detected_years: [
      normalizedYear,
    ],

    analytics: {
      yearly: [
        {
          year:
            normalizedYear,

          sourceDocumentId,

          incomeDeclarantUah,

          incomeHouseholdUah,
        },
      ],

      transitions: [],
    },

    source_documents:
      row?.source_url
        ? [
            {
              id:
                sourceDocumentId,

              url:
                row.source_url,
            },
          ]
        : [],

    facts: [],

    income_fact_count:
      incomeFactCount,
  };
}

export async function loadDeterministicMultiYearIncomeAnalyticsContext(
  entityId,
  years,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const normalizedYears =
    [
      ...new Set(
        (
          Array.isArray(years)
            ? years
            : []
        )
          .map(Number)
          .filter(
            Number.isInteger
          )
      ),
    ].sort(
      (a, b) =>
        a - b
    );

  if (
    !entityId ||
    normalizedYears.length < 2
  ) {
    return null;
  }

  /*
   * Передаємо список років
   * одним SQL-параметром.
   */
  const yearsText =
    normalizedYears.join(",");

  const rows =
    await sql`
      WITH requested_years AS (
        SELECT
          unnest(
            string_to_array(
              ${yearsText},
              ','
            )::int[]
          ) AS year
      ),

      ranked AS (
        SELECT
          f.source_document_id,

          (
            f.value_json
            ->> 'declaration_year'
          )::int AS year,

          (
            f.value_json
            ->> 'published_at'
          )::timestamptz
            AS published_at,

          row_number() OVER (
            PARTITION BY
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

        INNER JOIN requested_years ry
          ON ry.year =
             (
               f.value_json
               ->> 'declaration_year'
             )::int

        WHERE
          f.entity_id =
            ${entityId}

          AND f.fact_type =
            'declaration_submission'
      ),

      canonical AS (
        SELECT
          source_document_id,
          year,
          published_at

        FROM ranked

        WHERE rn = 1
      )

      SELECT
        c.year,
        c.source_document_id,
        c.published_at,

        sd.url
          AS source_url,

        COALESCE(
          SUM(
            CASE
              WHEN
                UPPER(
                  COALESCE(
                    i.unit,
                    'UAH'
                  )
                ) = 'UAH'

                AND (
                  i.value_json
                  -> 'person'
                  ->> 'role'
                ) = 'declarant'

              THEN
                COALESCE(
                  i.value_number,
                  0
                )

              ELSE 0
            END
          ),
          0
        ) AS income_declarant_uah,

        COALESCE(
          SUM(
            CASE
              WHEN
                UPPER(
                  COALESCE(
                    i.unit,
                    'UAH'
                  )
                ) = 'UAH'

                AND (
                  i.value_json
                  -> 'person'
                  ->> 'role'
                ) IN (
                  'declarant',
                  'family'
                )

              THEN
                COALESCE(
                  i.value_number,
                  0
                )

              ELSE 0
            END
          ),
          0
        ) AS income_household_uah,

        COUNT(i.id)::int
          AS income_fact_count

      FROM canonical c

      LEFT JOIN source_documents sd
        ON sd.id =
           c.source_document_id

      LEFT JOIN facts i
        ON i.entity_id =
           ${entityId}

       AND i.source_document_id =
           c.source_document_id

       AND i.fact_type =
           'income'

      GROUP BY
        c.year,
        c.source_document_id,
        c.published_at,
        sd.url

      ORDER BY
        c.year ASC
    `;

  /*
   * Якщо хоча б один запитаний рік
   * не знайдено, optimization-path
   * не повинен змінювати семантику.
   */
  if (
    rows.length !==
    normalizedYears.length
  ) {
    return null;
  }

  const yearly =
    rows.map(
      (row) => ({
        year:
          Number(row.year),

        sourceDocumentId:
          row.source_document_id,

        publishedAt:
          row.published_at,

        incomeDeclarantUah:
          Number(
            row
              .income_declarant_uah ??
            0
          ),

        incomeHouseholdUah:
          Number(
            row
              .income_household_uah ??
            0
          ),

        incomeFactCount:
          Number(
            row
              .income_fact_count ??
            0
          ),
      })
    );

  const transitions = [];

  const round2 =
    (value) =>
      Math.round(
        Number(value) * 100
      ) / 100;

  for (
    let index = 1;
    index < yearly.length;
    index += 1
  ) {
    const previous =
      yearly[index - 1];

    const current =
      yearly[index];

    const before =
      Number(
        previous
          .incomeDeclarantUah
      );

    const after =
      Number(
        current
          .incomeDeclarantUah
      );

    const incomeDelta =
      round2(
        after - before
      );

    const incomeDeltaPercent =
      before === 0
        ? null
        : round2(
            (
              (
                after -
                before
              ) /
              Math.abs(before)
            ) *
            100
          );

    transitions.push({
      fromYear:
        previous.year,

      toYear:
        current.year,

      yearGap:
        current.year -
        previous.year,

      incomeDelta,

      incomeDeltaPercent,
    });
  }

  return {
    detected_years:
      normalizedYears,

    analytics: {
      yearly,
      transitions,
    },

    source_documents:
      rows
        .filter(
          (row) =>
            row.source_url
        )
        .map(
          (row) => ({
            id:
              row.source_document_id,

            url:
              row.source_url,
          })
        ),

    facts: [],
  };
}

export async function loadDeterministicIncomeContext(
  entityId,
  year,
  options = {},
) {
  const sql =
    options.sql ?? db();

  const normalizedYear =
    Number(year);

  if (
    !entityId ||
    !Number.isInteger(
      normalizedYear
    )
  ) {
    return null;
  }

  const rows =
    await sql`
      WITH canonical AS (
        SELECT
          f.source_document_id

        FROM facts f

        WHERE
          f.entity_id =
            ${entityId}

          AND f.fact_type =
            'declaration_submission'

          AND (
            f.value_json
            ->> 'declaration_year'
          )::int =
            ${normalizedYear}

        ORDER BY
          (
            f.value_json
            ->> 'published_at'
          )::timestamptz
            DESC NULLS LAST,

          f.created_at DESC

        LIMIT 1
      )

      SELECT
        c.source_document_id
          AS canonical_source_document_id,

        sd.url
          AS source_url,

        f.id,
        f.entity_id,
        f.fact_type,
        f.value_text,
        f.value_number,
        f.value_date,
        f.value_json,
        f.unit,
        f.source_document_id,
        f.valid_from,
        f.valid_to,
        f.confidence,
        f.verification_status,
        f.metadata,
        f.created_at

      FROM canonical c

      LEFT JOIN source_documents sd
        ON sd.id =
           c.source_document_id

      LEFT JOIN facts f
        ON f.entity_id =
           ${entityId}

       AND f.source_document_id =
           c.source_document_id

       AND f.fact_type =
           'income'

      ORDER BY
        f.created_at ASC
    `;

  if (!rows.length) {
    return null;
  }

  const canonicalSourceId =
    rows[0]
      ?.canonical_source_document_id ??
    null;

  if (!canonicalSourceId) {
    return null;
  }

  const sourceUrl =
    rows[0]
      ?.source_url ??
    null;

  const facts =
    rows
      .filter(
        (row) =>
          row?.fact_type ===
          "income"
      )
      .map(
        (row) => ({
          id:
            row.id,

          entity_id:
            row.entity_id,

          fact_type:
            row.fact_type,

          value_text:
            row.value_text,

          value_number:
            row.value_number,

          value_date:
            row.value_date,

          value_json:
            row.value_json,

          unit:
            row.unit,

          source_document_id:
            row.source_document_id,

          valid_from:
            row.valid_from,

          valid_to:
            row.valid_to,

          confidence:
            row.confidence,

          verification_status:
            row.verification_status,

          metadata: {
            ...(
              row.metadata ??
              {}
            ),

            declaration_year:
              normalizedYear,
          },

          created_at:
            row.created_at,
        })
      );

  return {
    detected_years: [
      normalizedYear,
    ],

    analytics: {
      yearly: [
        {
          year:
            normalizedYear,

          sourceDocumentId:
            canonicalSourceId,
        },
      ],
    },

    facts,

    source_documents:
      sourceUrl
        ? [
            {
              id:
                canonicalSourceId,

              url:
                sourceUrl,
            },
          ]
        : [],
  };
}
