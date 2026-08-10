import test from "node:test";
import assert from "node:assert/strict";

import {
  SOURCE_ADAPTER_CONTRACT_VERSION,
  defineSourceAdapter,
  isSourceAdapter,
} from "../src/source-adapter.js";

test("defines valid source adapter", () => {
  const collect = async () => [];
  const adapter = defineSourceAdapter({
    id: "example",
    name: "Example Source",
    source_type: "external",
    source_name: "Example Registry",
    provider: "example-provider",
    collect,
  });

  assert.equal(
    adapter.contract_version,
    SOURCE_ADAPTER_CONTRACT_VERSION,
  );
  assert.equal(adapter.id, "example");
  assert.equal(adapter.name, "Example Source");
  assert.equal(adapter.source_type, "external");
  assert.equal(adapter.source_name, "Example Registry");
  assert.equal(adapter.provider, "example-provider");
  assert.equal(adapter.collect, collect);
  assert.equal(isSourceAdapter(adapter), true);
  assert.equal(Object.isFrozen(adapter), true);
});

test("rejects missing required text fields", () => {
  assert.throws(
    () => defineSourceAdapter({
      name: "Example",
      source_type: "external",
    source_name: "Example Registry",
    provider: "example-provider",
      collect: async () => [],
    }),
    /id is required/,
  );

  assert.throws(
    () => defineSourceAdapter({
      id: "example",
      source_type: "external",
    source_name: "Example Registry",
    provider: "example-provider",
      collect: async () => [],
    }),
    /name is required/,
  );

  assert.throws(
    () => defineSourceAdapter({
      id: "example",
      name: "Example",
      source_name: "Example Registry",
      provider: "example-provider",
      collect: async () => [],
    }),
    /source_type is required/,
  );
});

test("rejects missing source provenance", () => {
  assert.throws(
    () => defineSourceAdapter({
      id: "example",
      name: "Example",
      source_type: "external",
      provider: "example-provider",
      collect: async () => [],
    }),
    /source_name is required/,
  );

  assert.throws(
    () => defineSourceAdapter({
      id: "example",
      name: "Example",
      source_type: "external",
      source_name: "Example Registry",
      collect: async () => [],
    }),
    /provider is required/,
  );
});

test("rejects adapter without collect function", () => {
  assert.throws(
    () => defineSourceAdapter({
      id: "example",
      name: "Example",
      source_type: "external",
    source_name: "Example Registry",
    provider: "example-provider",
    }),
    /collect must be a function/,
  );
});

test("detects invalid adapter shapes", () => {
  assert.equal(isSourceAdapter(null), false);
  assert.equal(isSourceAdapter({}), false);
  assert.equal(
    isSourceAdapter({
      contract_version: SOURCE_ADAPTER_CONTRACT_VERSION,
      id: "example",
      name: "Example",
      source_type: "external",
    source_name: "Example Registry",
    provider: "example-provider",
      collect: null,
    }),
    false,
  );
});


test("normalizes source adapter collect result", async () => {
  const { normalizeSourceAdapterResult } =
    await import("../src/source-adapter.js");

  const result = normalizeSourceAdapterResult({
    items: [
      { external_id: "1" },
      null,
    ],
    next_cursor: 42,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].external_id, "1");
  assert.equal(result.items[0].url, null);
  assert.equal(
    typeof result.items[0].observed_at,
    "string",
  );
  assert.equal(result.next_cursor, "42");
});

test("normalizes empty collect result", async () => {
  const { normalizeSourceAdapterResult } =
    await import("../src/source-adapter.js");

  assert.deepEqual(
    normalizeSourceAdapterResult(),
    {
      items: [],
      next_cursor: null,
    },
  );
});


test("normalizes canonical source adapter item", async () => {
  const { normalizeSourceAdapterItem } =
    await import("../src/source-adapter.js");

  const item = normalizeSourceAdapterItem({
    external_id: 123,
    url: "https://example.test/item/123",
    title: "Example item",
    published_at: "2026-08-01T10:00:00Z",
    observed_at: "2026-08-02T12:00:00Z",
    content: "Text",
    metadata: { category: "news" },
    raw_payload: { source: true },
  });

  assert.deepEqual(item, {
    external_id: "123",
    url: "https://example.test/item/123",
    title: "Example item",
    published_at: "2026-08-01T10:00:00.000Z",
    observed_at: "2026-08-02T12:00:00.000Z",
    content: "Text",
    metadata: { category: "news" },
    raw_payload: { source: true },
  });
});

test("canonical source item safely normalizes invalid optional values", async () => {
  const { normalizeSourceAdapterItem } =
    await import("../src/source-adapter.js");

  const item = normalizeSourceAdapterItem({
    published_at: "not-a-date",
    metadata: "invalid",
  });

  assert.equal(item.external_id, null);
  assert.equal(item.url, null);
  assert.equal(item.published_at, null);
  assert.equal(typeof item.observed_at, "string");
  assert.deepEqual(item.metadata, {});
  assert.equal(item.raw_payload, null);
});


test("drops source items without external id or url", async () => {
  const { normalizeSourceAdapterResult } =
    await import("../src/source-adapter.js");

  const result = normalizeSourceAdapterResult({
    items: [
      { title: "orphan" },
      { url: "https://example.test/item" },
    ],
  });

  assert.equal(result.items.length, 1);
  assert.equal(
    result.items[0].url,
    "https://example.test/item",
  );
});