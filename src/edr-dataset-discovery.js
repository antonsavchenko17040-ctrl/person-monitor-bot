export const EDR_DATASET_ID =
  "a1799820-195b-4982-8141-6e84f58103e7";
export const EDR_CKAN_PACKAGE_SHOW_URL =
  "https://data.gov.ua/api/3/action/package_show";
export const EDR_RESOURCE_NAMES =
  Object.freeze([
    "UO.zip",
    "FOP.zip",
  ]);
function optionalText(value) {
  if (value == null) return null;
  const normalized =
    String(value).trim();
  return normalized || null;
}
function normalizeDate(value) {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString();
  }
  const text =
    String(value).trim();
  if (!text) {
    return null;
  }
  const hasTimezone =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(
      text,
    );
  const normalizedText =
    hasTimezone
      ? text
      : `${text}Z`;
  const date =
    new Date(normalizedText);
  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}
function normalizeSize(value) {
  if (
    value == null ||
    value === ""
  ) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) &&
    number >= 0
    ? number
    : null;
}
export function normalizeEdrResource(
  resource = {},
) {
  return {
    name:
      optionalText(resource.name),
    id:
      optionalText(resource.id),
    format:
      optionalText(resource.format),
    url:
      optionalText(resource.url),
    hash:
      optionalText(resource.hash),
    last_modified:
      normalizeDate(
        resource.last_modified,
      ),
    size:
      normalizeSize(resource.size),
  };
}
function requireEdrResource(
  resources,
  name,
) {
  const resource =
    resources.find(
      (item) =>
        String(
          item?.name ?? "",
        ).trim() === name,
    );
  if (!resource) {
    throw new Error(
      `Missing EDR resource: ${name}`,
    );
  }
  return normalizeEdrResource(
    resource,
  );
}
export function buildEdrVersionKey(
  resources = [],
) {
  return resources
    .map((resource) => [
      resource.name ?? "",
      resource.id ?? "",
      resource.last_modified ?? "",
      resource.size ?? "",
    ].join("|"))
    .join("||");
}
function latestModifiedAt(
  resources,
) {
  const timestamps =
    resources
      .map(
        (resource) =>
          resource.last_modified,
      )
      .filter(Boolean)
      .map(
        (value) =>
          new Date(value).getTime(),
      )
      .filter(Number.isFinite);
  if (timestamps.length === 0) {
    return null;
  }
  return new Date(
    Math.max(...timestamps),
  ).toISOString();
}
export function normalizeEdrDatasetPackage(
  payload = {},
) {
  const result =
    payload?.result ??
    payload;
  const sourceResources =
    Array.isArray(result?.resources)
      ? result.resources
      : [];
  const resources =
    EDR_RESOURCE_NAMES.map(
      (name) =>
        requireEdrResource(
          sourceResources,
          name,
        ),
    );
  return {
    dataset_id:
      optionalText(result?.id) ??
      EDR_DATASET_ID,
    dataset_name:
      optionalText(result?.name),
    title:
      optionalText(result?.title),
    metadata_modified:
      normalizeDate(
        result?.metadata_modified,
      ),
    snapshot_modified_at:
      latestModifiedAt(resources),
    version_key:
      buildEdrVersionKey(
        resources,
      ),
    resources,
  };
}
export async function discoverEdrDataset({
  fetchImpl = globalThis.fetch,
  datasetId = EDR_DATASET_ID,
} = {}) {
  if (
    typeof fetchImpl !== "function"
  ) {
    throw new TypeError(
      "fetchImpl must be a function",
    );
  }
  const url =
    new URL(
      EDR_CKAN_PACKAGE_SHOW_URL,
    );
  url.searchParams.set(
    "id",
    datasetId,
  );
  const response =
    await fetchImpl(
      url.toString(),
      {
        headers: {
          accept:
            "application/json",
        },
      },
    );
  if (!response?.ok) {
    throw new Error(
      "EDR dataset discovery failed: " +
      `HTTP ${response?.status ?? "unknown"}`,
    );
  }
  const payload =
    await response.json();
  if (
    payload?.success !== true
  ) {
    throw new Error(
      "EDR dataset discovery failed: " +
      "CKAN response unsuccessful",
    );
  }
  return normalizeEdrDatasetPackage(
    payload,
  );
}