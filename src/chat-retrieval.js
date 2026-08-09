const DEFAULT_LIMITS = {
  facts: 40,
  relations: 30,
  mentions: 15,
  crossChecks: 20,
};

const STOP_WORDS = new Set([
  "і",
  "й",
  "та",
  "а",
  "але",
  "або",
  "у",
  "в",
  "на",
  "до",
  "за",
  "з",
  "із",
  "зі",
  "про",
  "по",
  "для",
  "від",
  "що",
  "які",
  "який",
  "яка",
  "яке",
  "яких",
  "хто",
  "де",
  "коли",
  "як",
  "чи",
  "це",
  "його",
  "її",
  "їх",
  "було",
  "був",
  "була",
  "були",
]);

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ґ/g, "г")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOP_WORDS.has(token) &&
        !/^(?:19|20)\d{2}$/.test(token),
    );
}

function searchableText(value) {
  if (value == null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(searchableText)
      .join(" ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(
        ([key, item]) =>
          `${key} ${searchableText(item)}`,
      )
      .join(" ");
  }

  return "";
}

function extractYears(question) {
  return [
    ...new Set(
      String(question ?? "")
        .match(/\b(?:19|20)\d{2}\b/g) ??
        [],
    ),
  ].map(Number);
}

function queryHints(question) {
  const q = normalize(question);

  return {
    income:
      /дохід|доход|зарплат|виплат|гонорар|прибут/.test(q),

    cash:
      /грош|готів|кошт|актив/.test(q),

    realEstate:
      /нерух|квартир|будин|земл|гараж|офіс|приміщ/.test(q),

    vehicle:
      /авто|автомоб|машин|транспорт|vehicle/.test(q),

    family:
      /сім|дружин|чоловік|дитин|батьк|матір|родич/.test(q),

    employment:
      /посад|робот|кар.?єр|працю|організаці|компан/.test(q),

    relations:
      /зв.?яз|пов.?язан|власник|правовласник|трет/.test(q),

    news:
      /новин|згад|публікац|медіа|статт/.test(q),

    crossChecks:
      /крос|перевір|ризик|аномал|підозр|невідповід|змін/.test(q),
  };
}

function topicBoost(
  item,
  hints,
  kind,
) {
  const type =
    String(
      item?.fact_type ??
      item?.relation_type ??
      item?.check_type ??
      "",
    )
      .toLowerCase()
      .trim();

  const text =
    normalize(searchableText(item));

  let score = 0;

  if (kind === "fact") {
    if (
      hints.income &&
      type === "income"
    ) {
      score += 40;
    }

    if (
      hints.cash &&
      type === "cash_asset"
    ) {
      score += 40;
    }

    if (
      hints.realEstate &&
      type === "real_estate"
    ) {
      score += 40;
    }

    if (
      hints.vehicle &&
      type === "vehicle"
    ) {
      score += 40;
    }

    if (
      hints.family &&
      type === "family_member"
    ) {
      score += 35;
    }

    if (
      hints.employment &&
      type === "employment"
    ) {
      score += 35;
    }
  }

  if (kind === "relation") {
    if (
      hints.income &&
      type === "income_from"
    ) {
      score += 40;
    }

    if (
      hints.family &&
      type === "family_member_observed"
    ) {
      score += 40;
    }

    if (
      hints.employment &&
      type === "employed_by"
    ) {
      score += 40;
    }

    if (
      hints.relations &&
      type === "third_party_rightsholder"
    ) {
      score += 50;
    }

    if (
      hints.realEstate &&
      type === "declared_asset" &&
      /real.?estate|нерух|квартир|будин|земл|гараж|приміщ|машиномісце/.test(text)
    ) {
      score += 35;
    }

    if (
      hints.vehicle &&
      type === "declared_asset" &&
      /vehicle|авто|автомоб|машин|транспорт/.test(text)
    ) {
      score += 35;
    }
  }

  if (kind === "cross_check") {
    if (
      hints.income &&
      /income|дохід/.test(text)
    ) {
      score += 35;
    }

    if (
      hints.cash &&
      /cash|грош|кошт/.test(text)
    ) {
      score += 35;
    }

    if (
      hints.realEstate &&
      /real.?estate|нерух/.test(text)
    ) {
      score += 30;
    }

    if (
      hints.vehicle &&
      /vehicle|авто|транспорт/.test(text)
    ) {
      score += 30;
    }

    if (
      hints.employment &&
      /employment|career|посад|робот/.test(text)
    ) {
      score += 30;
    }
  }

  return score;
}

function itemYears(item) {
  const result = new Set();

  const add = (value) => {
    const year = Number(value);

    if (
      Number.isInteger(year) &&
      year >= 1900 &&
      year <= 2100
    ) {
      result.add(year);
    }
  };

  add(item?.metadata?.declaration_year);
  add(item?.metadata?.year);

  add(item?.details?.declaration_year);
  add(item?.details?.year);
  add(item?.details?.from_year);
  add(item?.details?.to_year);

  return result;
}

function yearBoost(item, requestedYears) {
  if (!requestedYears.length) {
    return 0;
  }

  const availableYears =
    itemYears(item);

  let matches = 0;

  for (const year of requestedYears) {
    if (availableYears.has(year)) {
      matches += 1;
    }
  }

  let score =
    matches * 12;

  if (
    requestedYears.length > 1 &&
    matches === requestedYears.length
  ) {
    score += 30;
  }

  return score;
}

function balanceRequestedYears(
  ranked,
  requestedYears,
  limit,
) {
  if (
    requestedYears.length < 2 ||
    ranked.length <= 1
  ) {
    return ranked.slice(0, limit);
  }

  const selected = [];
  const selectedIndexes =
    new Set();

  const quota =
    Math.max(
      1,
      Math.floor(
        limit /
        requestedYears.length
      ),
    );

  for (const year of requestedYears) {
    let taken = 0;

    for (
      let index = 0;
      index < ranked.length;
      index += 1
    ) {
      if (
        selectedIndexes.has(index) ||
        !itemYears(
          ranked[index].item
        ).has(year)
      ) {
        continue;
      }

      selected.push(
        ranked[index]
      );

      selectedIndexes.add(index);

      taken += 1;

      if (taken >= quota) {
        break;
      }
    }
  }

  for (
    let index = 0;
    index < ranked.length &&
    selected.length < limit;
    index += 1
  ) {
    if (
      selectedIndexes.has(index)
    ) {
      continue;
    }

    selected.push(
      ranked[index]
    );

    selectedIndexes.add(index);
  }

  return selected
    .slice(0, limit);
}

function hasDomainIntent(hints) {
  return Boolean(
    hints.income ||
    hints.cash ||
    hints.realEstate ||
    hints.vehicle ||
    hints.family ||
    hints.employment
  );
}

function crossCheckMatchesIntent(
  item,
  hints,
) {
  const text =
    normalize(searchableText(item));

  if (
    hints.income &&
    /income|financial|дохід|доход/.test(text)
  ) {
    return true;
  }

  if (
    hints.cash &&
    /cash|грош|готів|кошт/.test(text)
  ) {
    return true;
  }

  if (
    hints.realEstate &&
    /real.?estate|asset.?dynamics|нерух|квартир|будин|земл/.test(text)
  ) {
    return true;
  }

  if (
    hints.vehicle &&
    /vehicle|asset.?dynamics|авто|автомоб|транспорт/.test(text)
  ) {
    return true;
  }

  if (
    hints.family &&
    /family|сім|родич/.test(text)
  ) {
    return true;
  }

  if (
    hints.employment &&
    /employment|career|посад|робот/.test(text)
  ) {
    return true;
  }

  return false;
}

function crossCheckMatchesYears(
  item,
  requestedYears,
) {
  if (!requestedYears.length) {
    return true;
  }

  const availableYears =
    itemYears(item);

  if (!availableYears.size) {
    return false;
  }

  return requestedYears.some(
    (year) =>
      availableYears.has(year),
  );
}

function scoreItem(
  item,
  questionTokens,
  years,
  hints,
  kind,
) {
  const text =
    normalize(searchableText(item));

  let score = 0;

  for (const token of questionTokens) {
    if (text.includes(token)) {
      score += 3;
    }
  }

  score +=
    yearBoost(
      item,
      years,
    );

  score +=
    topicBoost(
      item,
      hints,
      kind,
    );

  if (
    kind === "cross_check" &&
    hasDomainIntent(hints) &&
    !crossCheckMatchesIntent(
      item,
      hints,
    )
  ) {
    score -= 80;
  }

  if (
    kind === "cross_check" &&
    !crossCheckMatchesYears(
      item,
      years,
    )
  ) {
    score -= 100;
  }

  return score;
}

function rankItems(
  items,
  questionTokens,
  years,
  hints,
  limit,
  kind,
) {
  const ranked =
    (items ?? [])
      .map((item, index) => ({
        item,
        index,
        score:
          scoreItem(
            item,
            questionTokens,
            years,
            hints,
            kind,
          ),
      }))
      .filter(
        ({ score }) =>
          score > 0
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.index - b.index,
      );

  return balanceRequestedYears(
    ranked,
    years,
    limit,
  ).map(({ item, score }) => ({
    ...item,
    retrieval_score: score,
  }));
}

function referencedDocumentIds(result) {
  const ids = new Set();

  const add = (value) => {
    if (value) {
      ids.add(value);
    }
  };

  for (const fact of result.facts) {
    add(fact.source_document_id);
  }

  for (const relation of result.relations) {
    add(relation.source_document_id);
  }

  for (const mention of result.mentions) {
    add(mention.source_document_id);
  }

  for (const check of result.cross_checks) {
    add(check.left_source_document_id);
    add(check.right_source_document_id);
  }

  return ids;
}

export function retrieveSubjectContext(
  knowledge,
  question,
  options = {},
) {
  const limits = {
    ...DEFAULT_LIMITS,
    ...(options.limits ?? {}),
  };

  const questionTokens =
    tokens(question);

  const years =
    extractYears(question);

  const hints =
    queryHints(question);

  const facts =
    rankItems(
      knowledge?.facts,
      questionTokens,
      years,
      hints,
      limits.facts,
      "fact",
    );

  const relations =
    rankItems(
      knowledge?.relations,
      questionTokens,
      years,
      hints,
      limits.relations,
      "relation",
    );

  let mentions = [];

  if (hints.news) {
    mentions =
      rankItems(
        knowledge?.mentions,
        questionTokens,
        years,
        hints,
        limits.mentions,
        "mention",
      );
  }

  let crossChecks = [];

  if (hints.crossChecks) {
    crossChecks =
      rankItems(
        knowledge?.cross_checks,
        questionTokens,
        years,
        hints,
        limits.crossChecks,
        "cross_check",
      );
  }

  const partial = {
    facts,
    relations,
    mentions,
    cross_checks:
      crossChecks,
  };

  const documentIds =
    referencedDocumentIds(partial);

  const sourceDocuments =
    (knowledge?.source_documents ?? [])
      .filter(
        (document) =>
          documentIds.has(document.id),
      );

  return {
    retrieval_version:
      "subject-retrieval-v1",

    question,

    detected_years:
      years,

    subject:
      knowledge?.subject ?? null,

    analytics:
      knowledge?.analytics ?? null,

    facts,

    relations,

    mentions,

    cross_checks:
      crossChecks,

    source_documents:
      sourceDocuments,

    counts: {
      facts:
        facts.length,

      relations:
        relations.length,

      mentions:
        mentions.length,

      cross_checks:
        crossChecks.length,

      source_documents:
        sourceDocuments.length,
    },
  };
}
