import { createHash } from "node:crypto";

const DOCUMENT_URL_RE =
  /^https:\/\/public-api\.nazk\.gov\.ua\/v2\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

export function isNazkDocumentUrl(url) {
  return DOCUMENT_URL_RE.test(
    String(url ?? "").trim(),
  );
}

export function getNazkDocumentGuid(url) {
  const match = String(url ?? "")
    .trim()
    .match(DOCUMENT_URL_RE);

  return match?.[1]?.toLowerCase() ?? null;
}

function sha256(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  );
}

export async function fetchNazkDocument(
  url,
  options = {},
) {
  if (!isNazkDocumentUrl(url)) {
    throw new Error(
      "Invalid NACP document URL",
    );
  }

  const fetchImpl =
    options.fetchImpl ?? globalThis.fetch;

  const retries =
    Number.isInteger(options.retries)
      ? options.retries
      : 2;

  const timeoutMs =
    Number.isInteger(options.timeoutMs)
      ? options.timeoutMs
      : 20000;

  let lastError = null;

  for (
    let attempt = 0;
    attempt <= retries;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs,
    );

    try {
      const response =
        await fetchImpl(url, {
          method: "GET",

          headers: {
            Accept: "application/json",
            "User-Agent":
              "PersonMonitor/1.0 (+public-data-analysis)",
          },

          signal: controller.signal,
        });

      const raw = await response.text();

      if (
        (
          response.status === 429 ||
          response.status >= 500
        ) &&
        attempt < retries
      ) {
        await sleep(
          1000 * (attempt + 1),
        );

        continue;
      }

      if (!response.ok) {
        throw new Error(
          `NACP API HTTP ${response.status}`,
        );
      }

      let payload;

      try {
        payload = JSON.parse(raw);
      } catch {
        throw new Error(
          "NACP API returned invalid JSON",
        );
      }

      if (
        payload &&
        Object.hasOwn(payload, "error")
      ) {
        throw new Error(
          `NACP API error ${payload.error}`,
        );
      }

      if (
        !payload ||
        typeof payload !== "object"
      ) {
        throw new Error(
          "NACP API returned empty payload",
        );
      }

      return {
        payload,

        contentHash:
          sha256(raw),

        bytes:
          Buffer.byteLength(
            raw,
            "utf8",
          ),
      };
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await sleep(
          1000 * (attempt + 1),
        );

        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ??
    new Error("NACP API fetch failed");
}

function dataType(value) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

export function getNazkStepShapes(
  payload,
) {
  const data = payload?.data;

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return [];
  }

  return Object.entries(data)
    .filter(([key]) =>
      /^step_\d+$/.test(key),
    )
    .sort(
      ([a], [b]) =>
        Number(a.slice(5)) -
        Number(b.slice(5)),
    )
    .map(([step, wrapper]) => {
      const section =
        wrapper?.data ?? null;

      const keys = new Set();

      if (Array.isArray(section)) {
        for (
          const item of section.slice(0, 5)
        ) {
          if (
            item &&
            typeof item === "object" &&
            !Array.isArray(item)
          ) {
            for (
              const key of Object.keys(item)
            ) {
              keys.add(key);
            }
          }
        }
      } else if (
        section &&
        typeof section === "object"
      ) {
        for (
          const key of Object.keys(section)
        ) {
          keys.add(key);
        }
      }

      return {
        step,
        type: dataType(section),

        count:
          Array.isArray(section)
            ? section.length
            : section == null
              ? 0
              : 1,

        keys: [...keys].sort(),
      };
    });
}
