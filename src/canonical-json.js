import {
  createHash,
} from "node:crypto";


export const CANONICAL_JSON_HASH_VERSION =
  "canonical-json-sha256-v1";


function canonicalValue(value) {
  if (value === null) {
    return null;
  }

  const type =
    typeof value;

  if (
    type === "string" ||
    type === "boolean"
  ) {
    return value;
  }

  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(
        "Canonical JSON does not allow non-finite numbers",
      );
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(
      canonicalValue,
    );
  }

  if (type === "object") {
    const prototype =
      Object.getPrototypeOf(
        value,
      );

    if (
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      throw new TypeError(
        "Canonical JSON requires plain objects",
      );
    }

    return Object.keys(value)
      .sort()
      .reduce(
        (result, key) => {
          const item =
            value[key];

          if (
            item === undefined ||
            typeof item === "function" ||
            typeof item === "symbol" ||
            typeof item === "bigint"
          ) {
            throw new TypeError(
              `Canonical JSON contains unsupported value at ${key}`,
            );
          }

          result[key] =
            canonicalValue(
              item,
            );

          return result;
        },
        {},
      );
  }

  throw new TypeError(
    "Canonical JSON contains unsupported value",
  );
}


export function canonicalJson(
  value,
) {
  return JSON.stringify(
    canonicalValue(
      value,
    ),
  );
}


export function canonicalJsonHash(
  value,
) {
  return createHash(
    "sha256",
  )
    .update(
      canonicalJson(
        value,
      ),
    )
    .digest(
      "hex",
    );
}
