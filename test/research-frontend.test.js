import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("initial research form contains only the full-name input", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const form = /<form[\s\S]*?id="research-form"[\s\S]*?<\/form>/.exec(html)?.[0] ?? "";
  const inputs = [...form.matchAll(/<input\b/g)];

  assert.equal(inputs.length, 1);
  assert.match(form, /name="fullName"/);
  assert.match(form, /method="post"/);
  assert.match(form, /action="\/api\/research"/);
  assert.match(html, /\/assets\/app\.js\?v=research-clarification-v1/);
  assert.match(html, /id="research-organization"/);
  assert.match(html, /id="research-position"/);
  assert.match(html, /id="research-city"/);
  assert.match(html, /id="research-birth-date"/);
});
