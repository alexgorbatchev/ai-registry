import { describe, expect, it } from "bun:test";

import { createTemplateEnvironment } from "../createTemplateEnvironment";

describe("createTemplateEnvironment", () => {
  it("reads the build environment without starting the login shell", () => {
    let shellLoads = 0;
    const environment = createTemplateEnvironment({ PRESENT: "process" }, () => {
      shellLoads += 1;
      return { PRESENT: "shell" };
    });

    expect(environment.PRESENT).toBe("process");
    expect(shellLoads).toBe(0);
  });

  it("fills variables the build lacks from the login shell, loading it once", () => {
    let shellLoads = 0;
    const environment = createTemplateEnvironment({}, () => {
      shellLoads += 1;
      return { SHELL_ONLY: "from-shell", EMPTY_IN_SHELL: "" };
    });

    expect(environment.SHELL_ONLY).toBe("from-shell");
    expect(environment.EMPTY_IN_SHELL).toBe("");
    expect(environment.UNSET_EVERYWHERE).toBeUndefined();
    expect(shellLoads).toBe(1);
  });

  it("keeps an empty value the build sets instead of consulting the shell", () => {
    const environment = createTemplateEnvironment({ EXPLICITLY_EMPTY: "" }, () => ({ EXPLICITLY_EMPTY: "shell" }));

    expect(environment.EXPLICITLY_EMPTY).toBe("");
  });
});
