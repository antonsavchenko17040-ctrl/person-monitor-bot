import test from "node:test";
import assert from "node:assert/strict";
import {
  createHash,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  join,
} from "node:path";
import {
  downloadEdrDataset,
  downloadEdrResource,
  validateEdrDownloadResource,
} from "../src/edr-downloader.js";
async function temporaryDirectory() {
  return mkdtemp(
    join(
      tmpdir(),
      "person-monitor-edr-",
    ),
  );
}
test(
  "validates EDR download resource",
  () => {
    const resource =
      validateEdrDownloadResource({
        name: "UO.zip",
        url:
          "https://example.test/uo.zip",
        size: "5",
      });
    assert.equal(
      resource.name,
      "UO.zip",
    );
    assert.equal(
      resource.size,
      5,
    );
  },
);
test(
  "rejects unsafe EDR filename",
  () => {
    assert.throws(
      () =>
        validateEdrDownloadResource({
          name:
            "../UO.zip",
          url:
            "https://example.test/uo.zip",
        }),
      /ZIP filename/,
    );
  },
);
test(
  "streams EDR resource to disk and hashes it",
  async () => {
    const directory =
      await temporaryDirectory();
    try {
      const content =
        Buffer.from(
          "example-edr-data",
        );
      const result =
        await downloadEdrResource(
          {
            name: "UO.zip",
            id: "uo-resource",
            url:
              "https://example.test/uo.zip",
            size:
              content.length,
          },
          {
            destinationDir:
              directory,
            fetchImpl:
              async () =>
                new Response(
                  content,
                  {
                    status: 200,
                  },
                ),
          },
        );
      const saved =
        await readFile(
          result.path,
        );
      assert.deepEqual(
        saved,
        content,
      );
      assert.equal(
        result.size,
        content.length,
      );
      assert.equal(
        result.sha256,
        createHash("sha256")
          .update(content)
          .digest("hex"),
      );
      assert.equal(
        result.name,
        "UO.zip",
      );
      assert.equal(
        result.id,
        "uo-resource",
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);
test(
  "removes partial file when size verification fails",
  async () => {
    const directory =
      await temporaryDirectory();
    try {
      await assert.rejects(
        () =>
          downloadEdrResource(
            {
              name:
                "FOP.zip",
              url:
                "https://example.test/fop.zip",
              size: 999,
            },
            {
              destinationDir:
                directory,
              fetchImpl:
                async () =>
                  new Response(
                    Buffer.from(
                      "short",
                    ),
                    {
                      status: 200,
                    },
                  ),
            },
          ),
        /size mismatch/,
      );
      assert.deepEqual(
        await readdir(
          directory,
        ),
        [],
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);
test(
  "fails EDR download on HTTP error",
  async () => {
    const directory =
      await temporaryDirectory();
    try {
      await assert.rejects(
        () =>
          downloadEdrResource(
            {
              name: "UO.zip",
              url:
                "https://example.test/uo.zip",
            },
            {
              destinationDir:
                directory,
              fetchImpl:
                async () =>
                  new Response(
                    "Unavailable",
                    {
                      status: 503,
                    },
                  ),
            },
          ),
        /HTTP 503/,
      );
      assert.deepEqual(
        await readdir(
          directory,
        ),
        [],
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);
test(
  "downloads EDR dataset resources sequentially",
  async () => {
    const directory =
      await temporaryDirectory();
    const requested = [];
    try {
      const dataset =
        await downloadEdrDataset(
          {
            dataset_id:
              "edr-dataset",
            version_key:
              "snapshot-v1",
            resources: [
              {
                name:
                  "UO.zip",
                url:
                  "https://example.test/uo.zip",
                size: 2,
              },
              {
                name:
                  "FOP.zip",
                url:
                  "https://example.test/fop.zip",
                size: 3,
              },
            ],
          },
          {
            destinationDir:
              directory,
            fetchImpl:
              async (url) => {
                requested.push(
                  url,
                );
                const content =
                  url.endsWith(
                    "uo.zip",
                  )
                    ? "uo"
                    : "fop";
                return new Response(
                  content,
                  {
                    status: 200,
                  },
                );
              },
          },
        );
      assert.deepEqual(
        requested,
        [
          "https://example.test/uo.zip",
          "https://example.test/fop.zip",
        ],
      );
      assert.equal(
        dataset.dataset_id,
        "edr-dataset",
      );
      assert.equal(
        dataset.version_key,
        "snapshot-v1",
      );
      assert.equal(
        dataset.resources.length,
        2,
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);