import {
  createWriteStream,
} from "node:fs";
import {
  mkdir,
  rename,
  rm,
} from "node:fs/promises";
import {
  basename,
  join,
} from "node:path";
import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  Readable,
  Transform,
} from "node:stream";
import {
  pipeline,
} from "node:stream/promises";
function requiredText(
  value,
  field,
) {
  const normalized =
    String(value ?? "").trim();
  if (!normalized) {
    throw new TypeError(
      `${field} is required`,
    );
  }
  return normalized;
}
function normalizeExpectedSize(
  value,
) {
  if (
    value == null ||
    value === ""
  ) {
    return null;
  }
  const size =
    Number(value);
  if (
    !Number.isSafeInteger(size) ||
    size < 0
  ) {
    throw new TypeError(
      "resource.size must be a non-negative integer",
    );
  }
  return size;
}
function toNodeReadable(
  body,
) {
  if (!body) {
    throw new Error(
      "EDR download response has no body",
    );
  }
  if (
    typeof body.getReader === "function"
  ) {
    return Readable.fromWeb(
      body,
    );
  }
  if (
    typeof body.pipe === "function"
  ) {
    return body;
  }
  throw new TypeError(
    "Unsupported download response body",
  );
}
export function validateEdrDownloadResource(
  resource = {},
) {
  const name =
    requiredText(
      resource.name,
      "resource.name",
    );
  const url =
    requiredText(
      resource.url,
      "resource.url",
    );
  const fileName =
    basename(name);
  if (
    fileName !== name ||
    !fileName.toLowerCase().endsWith(".zip")
  ) {
    throw new TypeError(
      "resource.name must be a ZIP filename",
    );
  }
  return {
    ...resource,
    name,
    url,
    size:
      normalizeExpectedSize(
        resource.size,
      ),
  };
}
export async function downloadEdrResource(
  resource,
  {
    destinationDir,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (
    typeof fetchImpl !== "function"
  ) {
    throw new TypeError(
      "fetchImpl must be a function",
    );
  }
  const destination =
    requiredText(
      destinationDir,
      "destinationDir",
    );
  const normalized =
    validateEdrDownloadResource(
      resource,
    );
  await mkdir(
    destination,
    {
      recursive: true,
    },
  );
  const finalPath =
    join(
      destination,
      normalized.name,
    );
  const tempPath =
    `${finalPath}.part-${randomUUID()}`;
  const hash =
    createHash("sha256");
  let downloadedBytes = 0;
  try {
    const response =
      await fetchImpl(
        normalized.url,
        {
          headers: {
            accept:
              "application/zip,application/octet-stream,*/*",
          },
        },
      );
    if (!response?.ok) {
      throw new Error(
        "EDR download failed: " +
        `HTTP ${response?.status ?? "unknown"} ` +
        `for ${normalized.name}`,
      );
    }
    const meter =
      new Transform({
        transform(
          chunk,
          encoding,
          callback,
        ) {
          const buffer =
            Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(
                  chunk,
                  encoding,
                );
          downloadedBytes +=
            buffer.length;
          hash.update(
            buffer,
          );
          callback(
            null,
            buffer,
          );
        },
      });
    await pipeline(
      toNodeReadable(
        response.body,
      ),
      meter,
      createWriteStream(
        tempPath,
        {
          flags: "wx",
        },
      ),
    );
    if (
      normalized.size != null &&
      downloadedBytes !==
        normalized.size
    ) {
      throw new Error(
        "EDR download size mismatch: " +
        `${normalized.name} expected ` +
        `${normalized.size}, received ` +
        `${downloadedBytes}`,
      );
    }
    const sha256 =
      hash.digest("hex");
    await rm(
      finalPath,
      {
        force: true,
      },
    );
    await rename(
      tempPath,
      finalPath,
    );
    return {
      name:
        normalized.name,
      id:
        normalized.id ?? null,
      url:
        normalized.url,
      path:
        finalPath,
      size:
        downloadedBytes,
      sha256,
    };
  } catch (error) {
    await rm(
      tempPath,
      {
        force: true,
      },
    );
    throw error;
  }
}
export async function downloadEdrDataset(
  dataset = {},
  options = {},
) {
  const resources =
    Array.isArray(
      dataset?.resources,
    )
      ? dataset.resources
      : [];
  if (
    resources.length === 0
  ) {
    throw new Error(
      "EDR dataset has no resources to download",
    );
  }
  const downloads = [];
  for (
    const resource of resources
  ) {
    downloads.push(
      await downloadEdrResource(
        resource,
        options,
      ),
    );
  }
  return {
    dataset_id:
      dataset?.dataset_id ?? null,
    version_key:
      dataset?.version_key ?? null,
    resources:
      downloads,
  };
}