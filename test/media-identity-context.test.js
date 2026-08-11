import test from "node:test";
import assert from "node:assert/strict";

import {
  MEDIA_IDENTITY_CONTEXT_VERSION,
  MEDIA_IDENTITY_CONTEXT_LIMITS,
  extractMediaIdentityContext,
} from "../src/media-identity-context.js";

function subject() {
  return {
    full_name:
      "Савченко Антон Віталійович",

    aliases: [
      "Антон Віталійович Савченко",
    ],

    organization:
      "Національне агентство з питань запобігання корупції",

    position:
      "головний спеціаліст",
  };
}

test(
  "exports localized identity context version and limits",
  () => {
    assert.equal(
      MEDIA_IDENTITY_CONTEXT_VERSION,
      "media-identity-context-v1",
    );

    assert.equal(
      MEDIA_IDENTITY_CONTEXT_LIMITS
        .radius,
      600,
    );

    assert.equal(
      MEDIA_IDENTITY_CONTEXT_LIMITS
        .maxMentions,
      5,
    );

    assert.equal(
      MEDIA_IDENTITY_CONTEXT_LIMITS
        .maxChars,
      4000,
    );
  },
);

test(
  "keeps context located near target name",
  () => {
    const output =
      extractMediaIdentityContext(
        subject(),
        [
          "Савченко Антон Віталійович працює у Національному агентстві з питань запобігання корупції.",
          "Він обіймає посаду головного спеціаліста.",
        ].join(" "),
      );

    assert.match(
      output.text,
      /Савченко Антон Віталійович/u,
    );

    assert.match(
      output.text,
      /Національному агентстві/u,
    );

    assert.equal(
      output.stats
        .mention_windows,
      1,
    );
  },
);

test(
  "does not import distant context from another person",
  () => {
    const distant =
      "X".repeat(
        2500,
      );

    const output =
      extractMediaIdentityContext(
        subject(),
        [
          "Савченко Антон Віталійович згадується у матеріалі.",
          distant,
          "Петренко Іван Іванович працює у Національному агентстві з питань запобігання корупції та є головним спеціалістом.",
        ].join(" "),
      );

    assert.match(
      output.text,
      /Савченко Антон Віталійович/u,
    );

    assert.doesNotMatch(
      output.text,
      /Петренко Іван Іванович/u,
    );

    assert.doesNotMatch(
      output.text,
      /Національному агентстві/u,
    );
  },
);

test(
  "recognizes reordered full name inside local window",
  () => {
    const output =
      extractMediaIdentityContext(
        {
          ...subject(),

          aliases:
            [],
        },
        "У матеріалі зазначено: Антон Віталійович Савченко працює у Києві.",
      );

    assert.match(
      output.text,
      /Антон Віталійович Савченко/u,
    );

    assert.equal(
      output.stats
        .mention_windows,
      1,
    );
  },
);

test(
  "returns empty context when target name is absent",
  () => {
    const output =
      extractMediaIdentityContext(
        subject(),
        "Петренко Іван Іванович працює в іншій установі.",
      );

    assert.equal(
      output.text,
      "",
    );

    assert.equal(
      output.stats
        .mention_windows,
      0,
    );

    assert.equal(
      output.stats
        .context_chars,
      0,
    );
  },
);
