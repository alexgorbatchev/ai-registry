import { describe, expect, it } from "bun:test";

import { getProfileLocalCommandOutputName } from "../profileLocalAssetNames";

describe("getProfileLocalCommandOutputName", () => {
  it("namespaces profile-local commands", () => {
    expect(getProfileLocalCommandOutputName("developer", "review.md")).toBe("--developer-review.md");
  });

  it("rejects non-markdown filenames", () => {
    expect(() => getProfileLocalCommandOutputName("developer", "review.txt")).toThrow(
      "Profile-local commands must use .md filenames: review.txt",
    );
  });

  it("rejects already-prefixed basenames", () => {
    expect(() => getProfileLocalCommandOutputName("developer", "--review.md")).toThrow(
      "Profile-local commands must not start with -- because the output name is namespaced automatically: --review.md",
    );
  });
});
