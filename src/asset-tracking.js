import { db } from "./db.js";
import {
  normalizeText,
  stableFingerprint,
} from "./utils.js";

const VERSION = "asset-tracking-v1";

function text(value) {
  return normalizeText(
    value ?? "",
  );
}

function number(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function overlap(left, right) {
  const a = new Set(left);
  const b = new Set(right);

  for (const item of a) {
    if (b.has(item)) {
      return true;
    }
  }

  return false;
}

function actorKey(actor) {
  if (!actor?.role) {
    return null;
  }

  if (actor.role === "declarant") {
    return "declarant";
  }

  if (actor.role === "family") {
    return [
      "family",
      text(actor.relation),
      text(actor.name),
    ]
      .filter(Boolean)
      .join(":");
  }

  if (actor.role === "third_party") {
    return "third-party";
  }

  return [
    actor.role,
    text(actor.name),
  ]
    .filter(Boolean)
    .join(":");
}

function holderKeys(valueJson) {
  const result = new Set();

  const direct =
    actorKey(
      valueJson?.person,
    );

  if (direct) {
    result.add(direct);
  }

  for (
    const right of
    valueJson?.rights ?? []
  ) {
    const key =
      actorKey(right?.actor);

    if (key) {
      result.add(key);
    }

    const thirdParty =
      text(
        right?.third_party_name,
      );

    if (thirdParty) {
      result.add(
        `third-party:${thirdParty}`,
      );
    }
  }

  return [...result].sort();
}

function thirdPartyKeys(valueJson) {
  return [
    ...new Set(
      (valueJson?.rights ?? [])
        .map(
          (right) =>
            text(
              right
                ?.third_party_name,
            ),
        )
        .filter(Boolean),
    ),
  ].sort();
}

export function assetFromFact(fact) {
  const value =
    fact.value_json ?? {};

  const kind =
    fact.fact_type;

  if (
    kind !== "real_estate" &&
    kind !== "vehicle"
  ) {
    return null;
  }

  const base = {
    factId:
      fact.id ?? null,

    kind,

    sourceDocumentId:
      fact.source_document_id ??
      null,

    holders:
      holderKeys(value),

    thirdParties:
      thirdPartyKeys(value),

    raw:
      value,
  };

  if (kind === "real_estate") {
    return {
      ...base,

      objectType:
        text(
          value.object_type ??
          fact.value_text,
        ),

      otherObjectType:
        text(
          value.other_object_type,
        ),

      country:
        text(value.country),

      region:
        text(value.region),

      district:
        text(value.district),

      city:
        text(value.city),

      area:
        number(
          value.total_area ??
          fact.value_number,
        ),

      acquisitionDate:
        text(
          value.acquisition_date,
        ),

      label:
        [
          value.object_type ??
            fact.value_text,

          value.city,

          value.total_area
            ? `${value.total_area} м²`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
    };
  }

  return {
    ...base,

    objectType:
      text(
        value.object_type ??
        fact.value_text,
      ),

    brand:
      text(value.brand),

    model:
      text(value.model),

    productionYear:
      number(
        value.production_year,
      ),

    acquisitionDate:
      text(
        value.acquisition_date,
      ),

    label:
      [
        value.brand,
        value.model,
        value.production_year,
      ]
        .filter(Boolean)
        .join(" "),
  };
}

function realEstateScore(left, right) {
  if (
    left.objectType &&
    right.objectType &&
    left.objectType !==
      right.objectType
  ) {
    return 0;
  }

  let score = 0;

  if (
    left.objectType &&
    left.objectType ===
      right.objectType
  ) {
    score += 20;
  }

  if (
    left.otherObjectType &&
    left.otherObjectType ===
      right.otherObjectType
  ) {
    score += 5;
  }

  if (
    left.area !== null &&
    right.area !== null
  ) {
    const difference =
      Math.abs(
        left.area -
        right.area,
      );

    const base =
      Math.max(
        Math.abs(left.area),
        Math.abs(right.area),
        1,
      );

    const relative =
      difference / base;

    if (difference <= 0.1) {
      score += 25;
    } else if (
      relative <= 0.01
    ) {
      score += 20;
    } else if (
      relative <= 0.03
    ) {
      score += 10;
    }
  }

  if (
    left.acquisitionDate &&
    left.acquisitionDate ===
      right.acquisitionDate
  ) {
    score += 20;
  }

  if (
    left.country &&
    left.country ===
      right.country
  ) {
    score += 5;
  }

  if (
    left.region &&
    left.region ===
      right.region
  ) {
    score += 5;
  }

  if (
    left.city &&
    left.city ===
      right.city
  ) {
    score += 10;
  }

  if (
    overlap(
      left.holders,
      right.holders,
    )
  ) {
    score += 15;
  }

  if (
    overlap(
      left.thirdParties,
      right.thirdParties,
    )
  ) {
    score += 10;
  }

  return Math.min(
    100,
    score,
  );
}

function vehicleScore(left, right) {
  if (
    left.brand &&
    right.brand &&
    left.brand !== right.brand
  ) {
    return 0;
  }

  if (
    left.model &&
    right.model &&
    left.model !== right.model
  ) {
    return 0;
  }

  let score = 0;

  if (
    left.brand &&
    left.brand === right.brand
  ) {
    score += 25;
  }

  if (
    left.model &&
    left.model === right.model
  ) {
    score += 30;
  }

  if (
    left.productionYear !== null &&
    left.productionYear ===
      right.productionYear
  ) {
    score += 20;
  }

  if (
    left.acquisitionDate &&
    left.acquisitionDate ===
      right.acquisitionDate
  ) {
    score += 10;
  }

  if (
    overlap(
      left.holders,
      right.holders,
    )
  ) {
    score += 15;
  }

  if (
    left.objectType &&
    left.objectType ===
      right.objectType
  ) {
    score += 5;
  }

  return Math.min(
    100,
    score,
  );
}

export function assetMatchScore(
  left,
  right,
) {
  if (
    !left ||
    !right ||
    left.kind !== right.kind
  ) {
    return 0;
  }

  if (
    left.kind ===
    "real_estate"
  ) {
    return realEstateScore(
      left,
      right,
    );
  }

  return vehicleScore(
    left,
    right,
  );
}

function assetEventKey(asset) {
  return stableFingerprint(
    VERSION,

    asset.kind,

    asset.factId ?? "",

    asset.objectType ?? "",

    asset.brand ?? "",
    asset.model ?? "",

    asset.productionYear ?? "",

    asset.country ?? "",
    asset.region ?? "",
    asset.city ?? "",

    asset.area ?? "",

    asset.acquisitionDate ??
      "",

    asset.holders.join("|"),
  );
}

export function matchAssetSets(
  previousAssets,
  currentAssets,
) {
  const candidates = [];

  for (
    let leftIndex = 0;
    leftIndex <
    previousAssets.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex = 0;
      rightIndex <
      currentAssets.length;
      rightIndex += 1
    ) {
      const score =
        assetMatchScore(
          previousAssets[
            leftIndex
          ],
          currentAssets[
            rightIndex
          ],
        );

      if (score >= 55) {
        candidates.push({
          leftIndex,
          rightIndex,
          score,
        });
      }
    }
  }

  for (
    const candidate
    of candidates
  ) {
    const leftAlternative =
      Math.max(
        0,
        ...candidates
          .filter(
            (item) =>
              item.leftIndex ===
                candidate.leftIndex &&
              item.rightIndex !==
                candidate.rightIndex,
          )
          .map(
            (item) =>
              item.score,
          ),
      );

    const rightAlternative =
      Math.max(
        0,
        ...candidates
          .filter(
            (item) =>
              item.rightIndex ===
                candidate.rightIndex &&
              item.leftIndex !==
                candidate.leftIndex,
          )
          .map(
            (item) =>
              item.score,
          ),
      );

    candidate.confirmed =
      candidate.score >= 70 &&
      (
        candidate.score -
        leftAlternative
      ) >= 10 &&
      (
        candidate.score -
        rightAlternative
      ) >= 10;
  }

  const usedLeft =
    new Set();

  const usedRight =
    new Set();

  const retained = [];

  for (
    const candidate
    of [...candidates]
      .filter(
        (item) =>
          item.confirmed,
      )
      .sort(
        (a, b) =>
          b.score - a.score,
      )
  ) {
    if (
      usedLeft.has(
        candidate.leftIndex,
      ) ||
      usedRight.has(
        candidate.rightIndex,
      )
    ) {
      continue;
    }

    usedLeft.add(
      candidate.leftIndex,
    );

    usedRight.add(
      candidate.rightIndex,
    );

    retained.push({
      event: "retained",
      score:
        candidate.score,

      previous:
        previousAssets[
          candidate.leftIndex
        ],

      current:
        currentAssets[
          candidate.rightIndex
        ],
    });
  }

  const unresolvedCandidates =
    candidates
      .filter(
        (candidate) =>
          !usedLeft.has(
            candidate.leftIndex,
          ) &&
          !usedRight.has(
            candidate.rightIndex,
          ),
      )
      .sort(
        (a, b) =>
          b.score - a.score,
      );

  const uncertain = [];

  for (
    const candidate
    of unresolvedCandidates
  ) {
    if (
      usedLeft.has(
        candidate.leftIndex,
      ) ||
      usedRight.has(
        candidate.rightIndex,
      )
    ) {
      continue;
    }

    usedLeft.add(
      candidate.leftIndex,
    );

    usedRight.add(
      candidate.rightIndex,
    );

    uncertain.push({
      event: "uncertain",
      score:
        candidate.score,

      previous:
        previousAssets[
          candidate.leftIndex
        ],

      current:
        currentAssets[
          candidate.rightIndex
        ],
    });
  }

  const disappeared =
    previousAssets
      .filter(
        (_, index) =>
          !usedLeft.has(index),
      )
      .map((asset) => ({
        event:
          "disappeared",

        score: 90,
        previous: asset,
        current: null,
      }));

  const appeared =
    currentAssets
      .filter(
        (_, index) =>
          !usedRight.has(index),
      )
      .map((asset) => ({
        event:
          "appeared",

        score: 90,
        previous: null,
        current: asset,
      }));

  return {
    retained,
    uncertain,
    disappeared,
    appeared,

    events: [
      ...retained,
      ...uncertain,
      ...disappeared,
      ...appeared,
    ],
  };
}

function careerRecord(
  year,
  fact,
) {
  if (!fact) {
    return {
      year,
      workplace: null,
      position: null,
      changed:
        false,
    };
  }

  return {
    year,

    workplace:
      fact.value_json
        ?.workplace ??
      null,

    position:
      fact.value_json
        ?.position ??
      fact.value_text ??
      null,

    changed: false,
  };
}

function buildCareer(records) {
  for (
    let index = 1;
    index < records.length;
    index += 1
  ) {
    const previous =
      records[index - 1];

    const current =
      records[index];

    current.changed =
      text(
        current.workplace,
      ) !==
        text(
          previous.workplace,
        ) ||
      text(
        current.position,
      ) !==
        text(
          previous.position,
        );
  }

  return records;
}

export async function buildEntityAssetTimeline(
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
          )::int AS year,

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

        f.id,
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
         'real_estate',
         'vehicle',
         'employment'
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
          year: row.year,

          sourceDocumentId:
            row.source_document_id,

          publishedAt:
            row.published_at,

          realEstate: [],
          vehicles: [],
          employment: null,
        },
      );
    }

    const current =
      years.get(row.year);

    if (
      row.fact_type ===
      "real_estate"
    ) {
      const asset =
        assetFromFact(row);

      if (asset) {
        current
          .realEstate
          .push(asset);
      }
    }

    if (
      row.fact_type ===
      "vehicle"
    ) {
      const asset =
        assetFromFact(row);

      if (asset) {
        current
          .vehicles
          .push(asset);
      }
    }

    if (
      row.fact_type ===
      "employment"
    ) {
      current.employment =
        row;
    }
  }

  const yearly =
    [...years.values()]
      .sort(
        (a, b) =>
          a.year - b.year,
      );

  const career =
    buildCareer(
      yearly.map((item) =>
        careerRecord(
          item.year,
          item.employment,
        ),
      ),
    );

  const transitions = [];

  for (
    let index = 1;
    index < yearly.length;
    index += 1
  ) {
    const previous =
      yearly[index - 1];

    const current =
      yearly[index];

    transitions.push({
      fromYear:
        previous.year,

      toYear:
        current.year,

      yearGap:
        current.year -
        previous.year,

      previousSourceDocumentId:
        previous
          .sourceDocumentId,

      currentSourceDocumentId:
        current
          .sourceDocumentId,

      realEstate:
        matchAssetSets(
          previous.realEstate,
          current.realEstate,
        ),

      vehicles:
        matchAssetSets(
          previous.vehicles,
          current.vehicles,
        ),
    });
  }

  return {
    entityId:
      entityRows[0].id,

    canonicalName:
      entityRows[0]
        .canonical_name,

    version: VERSION,

    yearly:
      yearly.map(
        (item) => ({
          year:
            item.year,

          realEstate:
            item
              .realEstate
              .length,

          vehicles:
            item
              .vehicles
              .length,
        }),
      ),

    career,
    transitions,
  };
}

export async function buildAllAssetTimelines(
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
      await buildEntityAssetTimeline(
        entity.id,
        { sql },
      ),
    );
  }

  return result;
}

export async function persistAssetEvents(
  timeline,
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
    of timeline.transitions
  ) {
    const groups = [
      [
        "real_estate",
        transition.realEstate,
      ],

      [
        "vehicle",
        transition.vehicles,
      ],
    ];

    for (
      const [kind, result]
      of groups
    ) {
      const persistable = [
        ...result.appeared,
        ...result.disappeared,
        ...result.uncertain,
      ];

      for (
        const event
        of persistable
      ) {
        const ruleCode =
          event.event ===
            "appeared"
            ? "AN_ASSET_APPEARED_V1"
            : event.event ===
                "disappeared"
              ? "AN_ASSET_DISAPPEARED_V1"
              : "AN_ASSET_UNCERTAIN_MATCH_V1";

        const previousKey =
          event.previous
            ? assetEventKey(
                event.previous,
              )
            : "";

        const currentKey =
          event.current
            ? assetEventKey(
                event.current,
              )
            : "";

        const checkKey =
          stableFingerprint(
            VERSION,
            timeline.entityId,
            transition.fromYear,
            transition.toYear,
            kind,
            ruleCode,
            previousKey,
            currentKey,
          );

        const details = {
          check_key:
            checkKey,

          tracking_version:
            VERSION,

          asset_kind:
            kind,

          event:
            event.event,

          from_year:
            transition.fromYear,

          to_year:
            transition.toYear,

          year_gap:
            transition.yearGap,

          match_score:
            event.score,

          previous_label:
            event.previous
              ?.label ?? null,

          current_label:
            event.current
              ?.label ?? null,

          note:
            "Аналітичний сигнал зміни між деклараціями; сам по собі не свідчить про порушення.",
        };

        const existing =
          await sql`
            SELECT id
            FROM cross_checks

            WHERE
              entity_id =
                ${timeline.entityId}

              AND check_type =
                'asset_tracking'

              AND rule_code =
                ${ruleCode}

              AND details
                ->> 'check_key'
                = ${checkKey}

            LIMIT 1
          `;

        if (existing.length) {
          await sql`
            UPDATE cross_checks

            SET
              left_fact_id =
                ${event.previous?.factId ?? null},

              right_fact_id =
                ${event.current?.factId ?? null},

              left_source_document_id =
                ${transition.previousSourceDocumentId},

              right_source_document_id =
                ${transition.currentSourceDocumentId},

              result =
                ${event.event},

              score =
                ${event.score},

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

            left_fact_id,
            right_fact_id,

            left_source_document_id,
            right_source_document_id,

            result,
            score,
            details
          )

          VALUES (
            ${timeline.entityId},
            'asset_tracking',
            ${ruleCode},

            ${event.previous?.factId ?? null},
            ${event.current?.factId ?? null},

            ${transition.previousSourceDocumentId},
            ${transition.currentSourceDocumentId},

            ${event.event},
            ${event.score},

            ${JSON.stringify(
              details,
            )}::jsonb
          )
        `;

        stats.inserted += 1;
      }
    }
  }

  return stats;
}
