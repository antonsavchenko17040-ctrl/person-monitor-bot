import test from "node:test";
import assert from "node:assert/strict";

import {
  MEDIA_CORRUPTION_ROLE_VERSION,
  MEDIA_CORRUPTION_ROLES,
  classifyMediaCorruptionRole,
} from "../src/media-corruption-role.js";

function subject() {
  return {
    full_name:
      "Олексій Чернишов",

    aliases: [],
  };
}

test(
  "exports media corruption role contract",
  () => {
    assert.equal(
      MEDIA_CORRUPTION_ROLE_VERSION,
      "media-corruption-role-v1",
    );

    assert.deepEqual(
      MEDIA_CORRUPTION_ROLES,
      {
        ADVERSE_CONTEXT:
          "adverse_context",

        ANTI_CORRUPTION_ACTIVITY:
          "anti_corruption_activity",

        RELATED_MENTION:
          "related_mention",
      },
    );
  },
);

test(
  "classifies Chernyshov NABU cooperation as anti-corruption activity",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "Олексій Чернишов та НАБУ посилюють співпрацю у сфері запобігання та протидії корупційним правопорушенням.",
      );

    assert.equal(
      result.role,
      "anti_corruption_activity",
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);

test(
  "classifies suspicion and improper benefit as adverse context",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "НАБУ повідомило Олексію Чернишову про підозру в одержанні неправомірної вигоди.",
      );

    assert.equal(
      result.role,
      "adverse_context",
    );

    assert.ok(
      result.signals.includes(
        "підозра",
      ),
    );

    assert.ok(
      result.signals.includes(
        "неправомірна вигода",
      ),
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);


test(
  "classifies neutral corruption-related mention as related mention",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "Олексій Чернишов згадується у матеріалі про засідання, на якому також обговорювали роботу НАБУ щодо іншої посадової особи.",
      );

    assert.equal(
      result.role,
      "related_mention",
    );

    assert.deepEqual(
      result.signals,
      [],
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);

test(
  "never infers wrongdoing from adverse context",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "Суд оголосив вирок Олексію Чернишову у кримінальному провадженні.",
      );

    assert.equal(
      result.role,
      "adverse_context",
    );

    assert.ok(
      result.signals.includes(
        "вирок",
      ),
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);


test(
  "does not assign another persons suspicion to the subject",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "НАБУ повідомило Івану Петренку про підозру в одержанні неправомірної вигоди. Олексій Чернишов окремо прокоментував роботу міністерства.",
      );

    assert.equal(
      result.role,
      "related_mention",
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);

test(
  "does not assign another persons verdict to the subject",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "Суд оголосив вирок Івану Петренку. Олексій Чернишов згадується далі у матеріалі щодо роботи міністерства.",
      );

    assert.equal(
      result.role,
      "related_mention",
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);


test(
  "does not assign same-sentence adverse context of another person to subject",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "Після того як НАБУ повідомило Івану Петренку про підозру в одержанні неправомірної вигоди, Олексій Чернишов прокоментував роботу міністерства.",
      );

    assert.equal(
      result.role,
      "related_mention",
    );

    assert.deepEqual(
      result.signals,
      [],
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);


test(
  "keeps subjects own adverse context before comma",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "НАБУ повідомило Олексію Чернишову про підозру в одержанні неправомірної вигоди, а Іван Петренко прокоментував перебіг розслідування.",
      );

    assert.equal(
      result.role,
      "adverse_context",
    );

    assert.ok(
      result.signals.includes(
        "підозра",
      ),
    );

    assert.ok(
      result.signals.includes(
        "неправомірна вигода",
      ),
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);


test(
  "classifies adjacent cooperation context as anti-corruption activity",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "НАБУ посилить співпрацю з Мінрегіоном у сфері запобігання та протидії корупції. Олексій Чернишов повідомив про подальшу взаємодію.",
      );

    assert.equal(
      result.role,
      "anti_corruption_activity",
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);


test(
  "does not assign adjacent anti-corruption activity of another person to subject",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "Іван Петренко та НАБУ посилюють співпрацю у сфері запобігання та протидії корупції. Олексій Чернишов окремо прокоментував бюджет міністерства.",
      );

    assert.equal(
      result.role,
      "related_mention",
    );

    assert.deepEqual(
      result.signals,
      [],
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);


test(
  "classifies cooperation two clauses before subject as anti-corruption activity",
  () => {
    const result =
      classifyMediaCorruptionRole(
        subject(),
        "Міністерство розвитку громад та територій України та ДІАМ посилять співпрацю у сфері запобігання та протидії корупційним правопорушенням. Сторони домовилися про спільні заходи. Міністр розвитку громад та територій України Олексій Чернишов підписав відповідний меморандум.",
      );

    assert.equal(
      result.role,
      "anti_corruption_activity",
    );

    assert.equal(
      result.wrongdoing_inferred,
      false,
    );
  },
);
