import { describe, expect, it } from "vitest";

const { isStaleOnly } = require("../scripts/apply_metadata_only_cleanup.js");

describe("metadata-only cleanup routing", () => {
  it("uses the issue bucket emitted by the current manifest", () => {
    expect(
      isStaleOnly({
        issue_bucket: "metadata_only",
        risk_bucket: "cheap_model_candidate",
        issues: ["stale_llm_source"],
      }),
    ).toBe(true);
  });

  it("rejects rows with any content issue", () => {
    expect(
      isStaleOnly({
        issue_bucket: "metadata_only",
        risk_bucket: "cheap_model_candidate",
        issues: ["stale_llm_source", "low_value_example"],
      }),
    ).toBe(false);
  });
});
