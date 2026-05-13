import { describe, expect, it } from "bun:test";

import {
  createSkillPermission,
} from "../profileLocalAssetRules";

describe("createSkillPermission", () => {
  it("auto-allows harness-local skills by harness name prefix", () => {
    expect(createSkillPermission(["alpha", "beta"], [], "opencode")).toEqual({
      "*": "deny",
      "opencode-*": "allow",
      alpha: "allow",
      beta: "allow",
    });
  });

  it("expands wildcard manifests to an explicit global skill allowlist", () => {
    expect(createSkillPermission(["alpha", "beta"], [])).toEqual({
      "*": "deny",
      alpha: "allow",
      beta: "allow",
    });
  });

  it("allows wildcard manifests to use global skills plus their own local skills", () => {
    expect(createSkillPermission(["global-a", "global-b"], ["local-a", "local-b"])).toEqual({
      "*": "deny",
      "global-a": "allow",
      "global-b": "allow",
      "local-a": "allow",
      "local-b": "allow",
    });
  });

  it("denies all skills when neither global nor local skills are enabled", () => {
    expect(createSkillPermission([], [])).toEqual({
      "*": "deny",
    });
  });
});
