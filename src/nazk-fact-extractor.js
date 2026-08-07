import { stableFingerprint } from "./utils.js";

const VERSION = "nazk-structured-v1";

function stepData(payload, number) {
  return payload?.data?.[`step_${number}`]?.data ?? null;
}

function stepArray(payload, number) {
  const value = stepData(payload, number);
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  const text = String(value ?? "").trim();

  if (
    !text ||
    text === "[Не застосовується]" ||
    text === "[Конфіденційна інформація]"
  ) {
    return null;
  }

  return text;
}

export function parseDeclaredNumber(value) {
  const raw = clean(value);

  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}

function fullName(data) {
  return [
    clean(data?.lastname),
    clean(data?.firstname),
    clean(data?.middlename),
  ]
    .filter(Boolean)
    .join(" ") || null;
}

function sourceName(item) {
  return (
    clean(item?.source_ua_company_name) ||
    clean(item?.source_ukr_company_name) ||
    clean(item?.source_ua_company_code) ||
    clean(item?.source_ukr_fullname) ||
    clean(item?.source_ua_lastname) ||
    clean(item?.source_eng_company_name) ||
    clean(item?.source_eng_fullname) ||
    null
  );
}

function buildActorMap(payload) {
  const profile = stepData(payload, 1) ?? {};

  const actors = new Map();

  actors.set("1", {
    ref: "1",
    role: "declarant",
    relation: "декларант",
    name: fullName(profile),
  });

  for (const member of stepArray(payload, 2)) {
    const ref = clean(member.id);

    if (!ref) {
      continue;
    }

    actors.set(ref, {
      ref,
      role: "family",
      relation:
        clean(member.subjectRelation) ??
        "член сім'ї",

      name: fullName(member),
    });
  }

  return actors;
}

function resolveActor(ref, actors) {
  const value = clean(ref);

  if (!value) {
    return null;
  }

  const known = actors.get(value);

  if (known) {
    return known;
  }

  if (value === "j") {
    return {
      ref: "j",
      role: "third_party",
      relation: null,
      name: null,
    };
  }

  return {
    ref: value,
    role: "unknown",
    relation: null,
    name: null,
  };
}

function thirdPartyName(right) {
  const company =
    clean(right?.ua_company_name) ||
    clean(right?.ukr_company_name) ||
    clean(right?.eng_company_name);

  if (company) {
    return company;
  }

  const name = [
    clean(right?.ua_lastname),
    clean(right?.ua_firstname),
    clean(right?.ua_middlename),
  ]
    .filter(Boolean)
    .join(" ");

  return name || null;
}

function reduceRights(rights, actors) {
  if (!Array.isArray(rights)) {
    return [];
  }

  return rights.map((right) => {
    const ref =
      clean(right?.rightBelongs);

    const actor =
      resolveActor(ref, actors);

    return {
      belongs_ref: ref,

      actor,

      ownership_type:
        clean(right?.ownershipType),

      other_ownership:
        clean(right?.otherOwnership),

      share_percent:
        parseDeclaredNumber(
          right?.["percent-ownership"],
        ),

      third_party_name:
        ref === "j"
          ? thirdPartyName(right)
          : null,
    };
  });
}

function itemRef(item, index) {
  return (
    clean(item?.iteration) ||
    clean(item?.id) ||
    String(index)
  );
}

function factKey(
  documentGuid,
  factType,
  localRef,
) {
  return stableFingerprint(
    VERSION,
    documentGuid ?? "",
    factType,
    localRef,
  );
}

function makeFact({
  documentGuid,
  declarationYear,
  factType,
  sourceStep,
  localRef,
  valueText = null,
  valueNumber = null,
  unit = null,
  valueJson,
}) {
  return {
    factType,
    valueText,
    valueNumber,
    unit,
    valueJson,

    factKey: factKey(
      documentGuid,
      factType,
      localRef,
    ),

    metadata: {
      ingestion: VERSION,
      declaration_year:
        declarationYear ?? null,
      source_step: sourceStep,
      item_ref: localRef,
      document_guid:
        documentGuid ?? null,
    },
  };
}

export function extractNazkFacts(
  payload,
  options = {},
) {
  const documentGuid =
    options.documentGuid ?? null;

  const declarationYear =
    Number(
      payload?.declaration_year ??
      stepData(payload, 0)
        ?.declaration_year,
    ) || null;

  const actors =
    buildActorMap(payload);

  const facts = [];

  /* =========================================================
     STEP 1 — employment/profile
     ========================================================= */

  const profile =
    stepData(payload, 1);

  if (
    profile &&
    typeof profile === "object" &&
    !Array.isArray(profile)
  ) {
    const workplace =
      clean(profile.workPlace);

    const position =
      clean(profile.workPost);

    facts.push(
      makeFact({
        documentGuid,
        declarationYear,
        factType: "employment",
        sourceStep: "step_1",
        localRef: "profile",

        valueText:
          position ||
          workplace,

        valueJson: {
          person:
            actors.get("1"),

          workplace,

          workplace_edrpou:
            clean(
              profile.workPlaceEdrpou,
            ),

          position,

          post_type:
            clean(profile.postType),

          post_category:
            clean(profile.postCategory),

          responsible_position:
            clean(
              profile.responsiblePosition,
            ),

          responsible_position_exact:
            clean(
              profile
                .responsiblePositionWhatExact,
            ),
        },
      }),
    );
  }

  /* =========================================================
     STEP 2 — family
     ========================================================= */

  stepArray(payload, 2)
    .forEach((member, index) => {
      const ref =
        itemRef(member, index);

      facts.push(
        makeFact({
          documentGuid,
          declarationYear,
          factType:
            "family_member",
          sourceStep: "step_2",
          localRef: ref,

          valueText:
            fullName(member),

          valueJson: {
            person_ref:
              clean(member.id),

            name:
              fullName(member),

            relation:
              clean(
                member.subjectRelation,
              ),

            citizenship:
              clean(
                member.citizenship,
              ),
          },
        }),
      );
    });

  /* =========================================================
     STEP 3 — real estate
     ========================================================= */

  stepArray(payload, 3)
    .forEach((item, index) => {
      const ref =
        itemRef(item, index);

      const area =
        parseDeclaredNumber(
          item.totalArea,
        );

      facts.push(
        makeFact({
          documentGuid,
          declarationYear,
          factType:
            "real_estate",
          sourceStep: "step_3",
          localRef: ref,

          valueText:
            clean(item.objectType) ||
            clean(
              item.otherObjectType,
            ),

          valueNumber: area,
          unit:
            area == null
              ? null
              : "m2",

          valueJson: {
            person:
              resolveActor(
                item.person,
                actors,
              ),

            object_type:
              clean(item.objectType),

            other_object_type:
              clean(
                item.otherObjectType,
              ),

            country:
              clean(item.country),

            region:
              clean(item.region),

            district:
              clean(item.district),

            city:
              clean(item.city) ||
              clean(item.city_txt),

            total_area: area,

            acquisition_date:
              clean(item.owningDate),

            cost:
              parseDeclaredNumber(
                item.costAssessment,
              ),

            rights:
              reduceRights(
                item.rights,
                actors,
              ),
          },
        }),
      );
    });

  /* =========================================================
     STEP 6 — vehicles
     ========================================================= */

  stepArray(payload, 6)
    .forEach((item, index) => {
      const ref =
        itemRef(item, index);

      const brand =
        clean(item.brand);

      const model =
        clean(item.model);

      const description =
        [brand, model]
          .filter(Boolean)
          .join(" ") ||
        clean(item.objectType);

      facts.push(
        makeFact({
          documentGuid,
          declarationYear,
          factType:
            "vehicle",
          sourceStep: "step_6",
          localRef: ref,

          valueText:
            description,

          valueJson: {
            person:
              resolveActor(
                item.person,
                actors,
              ),

            object_type:
              clean(item.objectType),

            other_object_type:
              clean(
                item.otherObjectType,
              ),

            brand,
            model,

            production_year:
              parseDeclaredNumber(
                item.graduationYear,
              ),

            acquisition_date:
              clean(item.owningDate),

            cost:
              parseDeclaredNumber(
                item.costDate,
              ),

            rights:
              reduceRights(
                item.rights,
                actors,
              ),
          },
        }),
      );
    });

  /* =========================================================
     STEP 11 — income
     ========================================================= */

  stepArray(payload, 11)
    .forEach((item, index) => {
      const ref =
        itemRef(item, index);

      const amount =
        parseDeclaredNumber(
          item.sizeIncome,
        );

      facts.push(
        makeFact({
          documentGuid,
          declarationYear,
          factType: "income",
          sourceStep: "step_11",
          localRef: ref,

          valueText:
            clean(item.objectType) ||
            clean(
              item.otherObjectType,
            ),

          valueNumber: amount,
          unit:
            amount == null
              ? null
              : "UAH",

          valueJson: {
            person:
              resolveActor(
                item.person,
                actors,
              ),

            income_type:
              clean(item.objectType),

            other_income_type:
              clean(
                item.otherObjectType,
              ),

            amount,

            source:
              sourceName(item),
          },
        }),
      );
    });

  /* =========================================================
     STEP 12 — cash / monetary assets
     ========================================================= */

  stepArray(payload, 12)
    .forEach((item, index) => {
      const ref =
        itemRef(item, index);

      const amount =
        parseDeclaredNumber(
          item.sizeAssets,
        );

      const currency =
        clean(
          item.assetsCurrency,
        );

      facts.push(
        makeFact({
          documentGuid,
          declarationYear,
          factType:
            "cash_asset",
          sourceStep: "step_12",
          localRef: ref,

          valueText:
            clean(item.objectType) ||
            clean(
              item.otherObjectType,
            ),

          valueNumber: amount,
          unit: currency,

          valueJson: {
            person:
              resolveActor(
                item.person,
                actors,
              ),

            asset_type:
              clean(item.objectType),

            other_asset_type:
              clean(
                item.otherObjectType,
              ),

            amount,
            currency,

            organization_type:
              clean(
                item.organization_type,
              ),

            organization_name:
              clean(
                item
                  .organization_ua_company_name,
              ) ||
              clean(
                item
                  .organization_ukr_company_name,
              ) ||
              clean(
                item
                  .organization_eng_company_name,
              ),
          },
        }),
      );
    });

  return facts;
}
