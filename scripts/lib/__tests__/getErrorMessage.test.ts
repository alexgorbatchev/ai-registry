import { describe, expect, it } from "bun:test";

import { getErrorMessage } from "../getErrorMessage";

describe("getErrorMessage", () => {
  it("returns the message from Error instances without the stack", () => {
    const error = new Error("Build cancelled.");

    expect(getErrorMessage(error)).toBe("Build cancelled.");
  });

  it("falls back to stringifying non-Error values", () => {
    expect(getErrorMessage({ reason: "boom" })).toBe('{"reason":"boom"}');
  });
});
