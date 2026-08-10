import test from "node:test";
import assert from "node:assert/strict";
import {
  EDR_DATASET_ID,
  buildEdrVersionKey,
  discoverEdrDataset,
  normalizeEdrDatasetPackage,
  normalizeEdrResource,
} from "../src/edr-dataset-discovery.js";
const packagePayload = {
  success: true,
  result: {
    id: "canonical-edr-dataset",
    name: "edr",
    title: "ЄДР",
    metadata_modified:
      "2026-08-04T08:00:00Z",
    resources: [
      {
        name: "UO.zip",
        id: "uo-resource",
        format: "ZIP",
        url:
          "https://example.test/uo.zip",
        hash: "",
        last_modified:
          "2026-08-04T07:48:54.903807",
        size: 326598013,
      },
      {
        name: "FOP.zip",
        id: "fop-resource",
        format: "ZIP",
        url:
          "https://example.test/fop.zip",
        hash: null,
        last_modified:
          "2026-08-04T07:45:37.258895",
        size: "470649109",
      },
      {
        name: "UO_schema.zip",
        id: "schema-resource",
      },
    ],
  },
};
test(
  "normalizes EDR resource metadata",
  () => {
    const resource =
      normalizeEdrResource({
        name: "UO.zip",
        id: "uo",
        format: "ZIP",
        url:
          "https://example.test/uo.zip",
        hash: "",
        last_modified:
          "2026-08-04T07:48:54.903807",
        size: "326598013",
      });
    assert.equal(
      resource.name,
      "UO.zip",
    );
    assert.equal(
      resource.hash,
      null,
    );
    assert.equal(
      resource.size,
      326598013,
    );
    assert.equal(
      resource.last_modified,
      "2026-08-04T07:48:54.903Z",
    );
  },
);
test(
  "selects only required EDR archives",
  () => {
    const dataset =
      normalizeEdrDatasetPackage(
        packagePayload,
      );
    assert.equal(
      dataset.resources.length,
      2,
    );
    assert.deepEqual(
      dataset.resources.map(
        (item) => item.name,
      ),
      [
        "UO.zip",
        "FOP.zip",
      ],
    );
    assert.equal(
      dataset.dataset_id,
      "canonical-edr-dataset",
    );
    assert.equal(
      dataset.snapshot_modified_at,
      "2026-08-04T07:48:54.903Z",
    );
  },
);
test(
  "builds stable EDR version key",
  () => {
    const dataset =
      normalizeEdrDatasetPackage(
        packagePayload,
      );
    assert.equal(
      dataset.version_key,
      buildEdrVersionKey(
        dataset.resources,
      ),
    );
    assert.match(
      dataset.version_key,
      /uo-resource/,
    );
    assert.match(
      dataset.version_key,
      /470649109/,
    );
  },
);
test(
  "rejects incomplete EDR package",
  () => {
    assert.throws(
      () =>
        normalizeEdrDatasetPackage({
          result: {
            resources: [
              {
                name: "UO.zip",
              },
            ],
          },
        }),
      /Missing EDR resource: FOP\.zip/,
    );
  },
);
test(
  "discovers EDR package through injected fetch",
  async () => {
    let requestedUrl = null;
    const fetchImpl =
      async (url) => {
        requestedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () =>
            packagePayload,
        };
      };
    const dataset =
      await discoverEdrDataset({
        fetchImpl,
      });
    assert.match(
      requestedUrl,
      /package_show/,
    );
    assert.match(
      requestedUrl,
      new RegExp(
        encodeURIComponent(
          EDR_DATASET_ID,
        ),
      ),
    );
    assert.equal(
      dataset.resources.length,
      2,
    );
  },
);
test(
  "fails discovery on HTTP error",
  async () => {
    await assert.rejects(
      () =>
        discoverEdrDataset({
          fetchImpl:
            async () => ({
              ok: false,
              status: 503,
            }),
        }),
      /HTTP 503/,
    );
  },
);