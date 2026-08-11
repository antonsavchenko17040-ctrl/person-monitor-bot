import test from "node:test";
import assert from "node:assert/strict";

import {
  MEDIA_IDENTITY_VERSION,
  assessMediaIdentity,
  isConfirmedMediaIdentity,
} from "../src/media-identity.js";

function subject() {
  return {
    full_name:
      "Савченко Антон Віталійович",

    aliases: [
      "Антон Савченко",
      "Anton Savchenko",
    ],

    organization:
      "Національне агентство з питань запобігання корупції",

    position:
      "головний спеціаліст Відділу цифрової трансформації та інноваційного розвитку",

    city:
      "Київ",
  };
}

test(
  "exports media identity version",
  () => {
    assert.equal(
      MEDIA_IDENTITY_VERSION,
      "media-identity-v1",
    );
  },
);

test(
  "full name in title alone is probable not confirmed",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Савченко Антон Віталійович фігурує у матеріалі",
        },
      );

    assert.equal(
      output.level,
      "probable",
    );

    assert.equal(
      output.auto_accept,
      false,
    );
  },
);

test(
  "full name plus organization is confirmed",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Савченко Антон Віталійович",

          snippet:
            "Головний спеціаліст Національного агентства з питань запобігання корупції.",
        },
      );

    assert.equal(
      output.level,
      "confirmed",
    );

    assert.equal(
      output.auto_accept,
      true,
    );
  },
);

test(
  "full name only in snippet is not auto confirmed",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Новини дня",

          snippet:
            "У матеріалі згадується Савченко Антон Віталійович.",
        },
      );

    assert.equal(
      output.level,
      "possible",
    );

    assert.equal(
      output.auto_accept,
      false,
    );
  },
);

test(
  "rejects conflicting patronymic in title",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Савченко Антон Вікторович",

          snippet:
            "Наступна особа: Савченко Антон Віталійович.",
        },
      );

    assert.equal(
      output.level,
      "rejected",
    );

    assert.equal(
      output.hard_conflict,
      true,
    );
  },
);

test(
  "short alias alone cannot confirm identity",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Антон Савченко прокоментував подію",
        },
      );

    assert.equal(
      output.level,
      "rejected",
    );

    assert.equal(
      output.auto_accept,
      false,
    );
  },
);

test(
  "search query metadata is not identity evidence",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Інша публікація",

          snippet:
            "Звичайний текст.",

          searchMetadata: {
            query:
              "\"Савченко Антон Віталійович\" корупція",
          },
        },
      );

    assert.equal(
      output.score,
      0,
    );

    assert.equal(
      output.level,
      "rejected",
    );
  },
);

test(
  "reordered full name is probable without context",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Антон Віталійович Савченко — біографія",
        },
      );

    assert.equal(
      output.level,
      "probable",
    );

    assert.equal(
      output.auto_accept,
      false,
    );
  },
);

test(
  "same full name on unrelated profile is not automatically accepted",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Антон Віталійович Савченко",

          snippet:
            "Доцент кафедри університету.",
        },
      );

    assert.equal(
      output.level,
      "probable",
    );

    assert.equal(
      isConfirmedMediaIdentity(
        subject(),
        {
          title:
            "Антон Віталійович Савченко",

          snippet:
            "Доцент кафедри університету.",
        },
      ),
      false,
    );
  },
);

test(
  "generic agency word and city cannot confirm same full name",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Савченко Антон Віталійович",

          snippet:
            "Працює у туристичному агентстві в Києві.",
        },
      );

    assert.equal(
      output.auto_accept,
      false,
    );

    assert.notEqual(
      output.level,
      "confirmed",
    );
  },
);

test(
  "generic job title cannot confirm same full name",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Савченко Антон Віталійович",

          snippet:
            "Працює як головний спеціаліст іншого підрозділу.",
        },
      );

    assert.equal(
      output.auto_accept,
      false,
    );

    assert.notEqual(
      output.level,
      "confirmed",
    );
  },
);

test(
  "strong organization context still confirms same full name",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Савченко Антон Віталійович",

          snippet:
            "Працівник Національного агентства з питань запобігання корупції.",
        },
      );

    assert.equal(
      output.level,
      "confirmed",
    );

    assert.equal(
      output.auto_accept,
      true,
    );
  },
);

test(
  "strong position context can confirm same full name",
  () => {
    const output =
      assessMediaIdentity(
        subject(),
        {
          title:
            "Савченко Антон Віталійович",

          snippet:
            "Головний спеціаліст Відділу цифрової трансформації та інноваційного розвитку.",
        },
      );

    assert.equal(
      output.level,
      "confirmed",
    );

    assert.equal(
      output.auto_accept,
      true,
    );
  },
);

