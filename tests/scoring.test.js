import test from "node:test";
import assert from "node:assert/strict";
import { assessMatch } from "../src/scoring.js";

const subject = {
  full_name: "Савченко Антон Віталійович",
  aliases: [],
  organization: "Національне агентство з питань запобігання корупції",
  position: "головний спеціаліст Відділу цифрової трансформації та інноваційного розвитку",
  city: "Київ",
  excluded_terms: [],
  match_threshold: 75,
};

test("підтверджує збіг за ПІБ та організацією", () => {
  const result = assessMatch(subject, {
    title: "Савченко Антон Віталійович — Національне агентство з питань запобігання корупції",
    snippet: "Головний спеціаліст відділу цифрової трансформації, Київ",
    source: "Офіційний сайт",
  });
  assert.equal(result.level, "confirmed");
  assert.ok(result.score >= 85);
});

test("відсіює очевидного тезку", () => {
  const result = assessMatch(subject, {
    title: "Антон Савченко забив гол у матчі",
    snippet: "Футболіст команди провів тренування",
    source: "Спорт",
  });
  assert.equal(result.level, "rejected");
  assert.ok(result.score < 75);
});
