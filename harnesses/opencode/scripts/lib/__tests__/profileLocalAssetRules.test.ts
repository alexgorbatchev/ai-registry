import { describe, expect, it } from "bun:test";

import {
  createSkillPermission,
  getProfileLocalCommandOutputName,
} from "../profileLocalAssetRules";

describe("createSkillPermission", () => {
  it("allows all skills only for pure global wildcard manifests", () => {
    expect(createSkillPermission(["*"], ["alpha", "beta"], [])).toEqual({
      "*": "allow",
    });
  });

  it("denies by default and allows local skills before global skills", () => {
    expect(createSkillPermission(["*"], ["global-a", "global-b"], ["local-a", "local-b"])).toEqual({
      "*": "deny",
      "local-a": "allow",
      "local-b": "allow",
      "global-a": "allow",
      "global-b": "allow",
    });
  });

  it("can restrict a profile to profile-local skills only", () => {
    expect(createSkillPermission(["*"], ["global-a", "global-b"], ["local-a", "local-b"], true)).toEqual({
      "*": "deny",
      "local-a": "allow",
      "local-b": "allow",
    });
  });

  it("denies every skill when local-only mode is enabled without local skills", () => {
    expect(createSkillPermission(["*"], ["global-a", "global-b"], [], true)).toEqual({
      "*": "deny",
    });
  });
});

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
