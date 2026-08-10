export const SOURCE_ADAPTER_CONTRACT_VERSION = "source-adapter-v1";

function requiredText(value, field) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new TypeError(`${field} is required`);
  }
  return normalized;
}

export function defineSourceAdapter({
  id,
  name,
  source_type,
  source_name,
  provider,
  collect,
} = {}) {
  const adapterId = requiredText(id, "id");
  const adapterName = requiredText(name, "name");
  const sourceType = requiredText(source_type, "source_type");
  const sourceName = requiredText(source_name, "source_name");
  const providerName = requiredText(provider, "provider");

  if (typeof collect !== "function") {
    throw new TypeError("collect must be a function");
  }

  return Object.freeze({
    contract_version: SOURCE_ADAPTER_CONTRACT_VERSION,
    id: adapterId,
    name: adapterName,
    source_type: sourceType,
    source_name: sourceName,
    provider: providerName,
    collect,
  });
}

export function isSourceAdapter(value) {
  return Boolean(
    value &&
    value.contract_version === SOURCE_ADAPTER_CONTRACT_VERSION &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.source_type === "string" &&
    typeof value.source_name === "string" &&
    typeof value.provider === "string" &&
    typeof value.collect === "function"
  );
}


export function normalizeSourceAdapterResult(result = {}) {
  const items =
    (Array.isArray(result?.items)
      ? result.items
      : [])
      .filter(Boolean)
      .map((item) =>
        normalizeSourceAdapterItem(item)
      )
      .filter((item) =>
        Boolean(
          item.external_id ||
          item.url
        )
      );

  const nextCursor =
    result?.next_cursor == null
      ? null
      : String(result.next_cursor);

  return {
    items,
    next_cursor: nextCursor,
  };
}

function normalizeAdapterDate(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeSourceAdapterItem(item = {}) {
  const metadata =
    item?.metadata &&
    typeof item.metadata === "object" &&
    !Array.isArray(item.metadata)
      ? { ...item.metadata }
      : {};

  return {
    external_id: item?.external_id == null
      ? null
      : String(item.external_id),
    url: item?.url == null
      ? null
      : String(item.url),
    title: item?.title == null
      ? null
      : String(item.title),
    published_at: normalizeAdapterDate(item?.published_at),
    observed_at: normalizeAdapterDate(
      item?.observed_at ?? new Date(),
    ),
    content: item?.content == null
      ? null
      : String(item.content),
    metadata,
    raw_payload: item?.raw_payload ?? null,
  };
}
