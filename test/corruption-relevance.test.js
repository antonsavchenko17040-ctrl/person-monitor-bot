import test from "node:test";
import assert from "node:assert/strict";

import {
  CORRUPTION_RELEVANCE_VERSION,
  assessCorruptionRelevance,
  isCorruptionRelevant,
} from "../src/corruption-relevance.js";

test(
  "exports corruption relevance version",
  () => {
    assert.equal(
      CORRUPTION_RELEVANCE_VERSION,
      "corruption-relevance-v1",
    );
  },
);

test(
  "accepts direct corruption terminology",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "Посадовця викрили на хабарі",
        snippet:
          "Йому інкримінують одержання неправомірної вигоди.",
      });

    assert.equal(
      output.relevant,
      true,
    );

    assert.equal(
      output.classification,
      "direct",
    );

    assert.ok(
      output.direct_terms.length >= 1,
    );
  },
);

test(
  "accepts anti-corruption agency plus procedure",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "НАБУ повідомило посадовцю про підозру",
        snippet:
          "Триває розслідування кримінального провадження.",
      });

    assert.equal(
      output.relevant,
      true,
    );

    assert.equal(
      output.classification,
      "related",
    );

    assert.ok(
      output.agencies.includes(
        "НАБУ",
      ),
    );
  },
);

test(
  "does not accept NACP declaration by itself",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "Декларація Савченко Антон Віталійович",
        snippet:
          "Річна декларація субʼєкта декларування.",
        source:
          "НАЗК",
      });

    assert.equal(
      output.relevant,
      false,
    );

    assert.equal(
      output.classification,
      "not_corruption",
    );
  },
);

test(
  "does not accept ordinary court mention",
  () => {
    assert.equal(
      isCorruptionRelevant({
        title:
          "Ухвала районного суду",
        snippet:
          "Особа є відповідачем у цивільній справі.",
      }),
      false,
    );
  },
);

test(
  "does not accept ordinary business mention",
  () => {
    assert.equal(
      isCorruptionRelevant({
        title:
          "Антон Савченко очолив компанію",
        snippet:
          "Компанія представила новий продукт.",
      }),
      false,
    );
  },
);

test(
  "does not accept sport or social profile",
  () => {
    assert.equal(
      isCorruptionRelevant({
        title:
          "Антон Савченко — статистика гравця",
        url:
          "https://example.com/player",
      }),
      false,
    );
  },
);

test(
  "accepts conflict of interest",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "НАЗК виявило конфлікт інтересів",
      });

    assert.equal(
      output.relevant,
      true,
    );

    assert.equal(
      output.classification,
      "direct",
    );
  },
);

test(
  "accepts illegal enrichment",
  () => {
    assert.equal(
      isCorruptionRelevant({
        title:
          "Справа про незаконне збагачення посадовця",
      }),
      true,
    );
  },
);

test(
  "does not accept NACP news without corruption context",
  () => {
    assert.equal(
      isCorruptionRelevant({
        title:
          "НАЗК оприлюднило новий набір відкритих даних",
        snippet:
          "На сайті агентства опубліковано оновлену інформацію.",
      }),
      false,
    );
  },
);

test(
  "does not accept NABU mention without procedure",
  () => {
    assert.equal(
      isCorruptionRelevant({
        title:
          "НАБУ оголосило конкурс на вакантні посади",
        snippet:
          "Документи приймаються до кінця місяця.",
      }),
      false,
    );
  },
);

test(
  "does not accept investigation word without anti-corruption context",
  () => {
    assert.equal(
      isCorruptionRelevant({
        title:
          "Журналісти провели розслідування причин аварії",
        snippet:
          "Матеріал присвячений технічному стану будівлі.",
      }),
      false,
    );
  },
);

test(
  "does not accept ordinary declaration publication",
  () => {
    assert.equal(
      isCorruptionRelevant({
        title:
          "Опубліковано щорічну декларацію посадовця",
        snippet:
          "Документ доступний у Реєстрі декларацій.",
      }),
      false,
    );
  },
);

test(
  "does not accept ordinary civil court case",
  () => {
    assert.equal(
      isCorruptionRelevant({
        title:
          "Суд розглянув цивільний позов",
        snippet:
          "Справа стосується поділу майна.",
      }),
      false,
    );
  },
);

test(
  "accepts NABU investigation",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "НАБУ розпочало розслідування щодо посадовця",
      });

    assert.equal(
      output.relevant,
      true,
    );

    assert.equal(
      output.classification,
      "related",
    );
  },
);

test(
  "accepts HACC conviction",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "ВАКС ухвалив вирок у справі посадовця",
      });

    assert.equal(
      output.relevant,
      true,
    );

    assert.equal(
      output.classification,
      "related",
    );
  },
);

test(
  "does not accept generic anti-corruption site slogan",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "Cтан проходження перевірки",

        snippet:
          "Савченко Антон Віталійович, Головний спеціаліст. Створюємо умови, за яких корупція є невигідною та неприйнятною.",

        url:
          "https://nazk.gov.ua/uk/4407/",
      });

    assert.equal(
      output.relevant,
      false,
    );

    assert.equal(
      output.classification,
      "not_corruption",
    );
  },
);

test(
  "still accepts corruption explicitly stated in headline",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "Посадовця підозрюють у корупції",
      });

    assert.equal(
      output.relevant,
      true,
    );
  },
);

test(
  "does not confuse Ukrainian word nabuv with NABU",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "Посадовець набув квартиру",

        snippet:
          "Окремо триває розслідування причин дорожньої аварії.",
      });

    assert.equal(
      output.relevant,
      false,
    );

    assert.equal(
      output.agencies.includes(
        "НАБУ",
      ),
      false,
    );
  },
);

test(
  "still detects exact NABU acronym",
  () => {
    const output =
      assessCorruptionRelevance({
        title:
          "НАБУ розпочало розслідування щодо посадовця",
      });

    assert.equal(
      output.relevant,
      true,
    );

    assert.equal(
      output.agencies.includes(
        "НАБУ",
      ),
      true,
    );
  },
);

