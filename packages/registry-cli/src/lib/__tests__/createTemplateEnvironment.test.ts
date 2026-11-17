import { describe, expect, it } from "bun:test";

import { createTemplateEnvironment, loadLoginShellEnvironment, readAccountShell } from "../createTemplateEnvironment";

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

describe("loadLoginShellEnvironment", () => {
  it("starts the account's login shell from the password database", () => {
    const started: Array<string | undefined> = [];
    const environment = loadLoginShellEnvironment(
      () => "/usr/bin/zsh",
      (shell) => {
        started.push(shell);
        return { FROM_LOGIN_SHELL: "zsh" };
      },
    );

    expect(started).toEqual(["/usr/bin/zsh"]);
    expect(environment.FROM_LOGIN_SHELL).toBe("zsh");
  });

  it("reads this account's shell by default", () => {
    const started: Array<string | undefined> = [];
    loadLoginShellEnvironment(undefined, (shell) => {
      started.push(shell);
      return {};
    });

    expect(started).toEqual([readAccountShell() || undefined]);
  });

  it("falls back to SHELL detection when the password database names no shell", () => {
    const unreadableShells = [
      () => null,
      () => "",
      () => {
        throw new Error("no password database entry");
      },
    ];

    for (const readAccountShell of unreadableShells) {
      const started: Array<string | undefined> = [];
      loadLoginShellEnvironment(readAccountShell, (shell) => {
        started.push(shell);
        return {};
      });

      expect(started).toEqual([undefined]);
    }
  });
});

describe("readAccountShell", () => {
  it("reads the shell field of the Linux user database entry", () => {
    const commands: string[][] = [];
    const shell = readAccountShell("linux", 1000, (command) => {
      commands.push(command);
      return { exitCode: 0, stdout: "alex:x:1000:1000:Alex,,,:/home/alex:/usr/bin/zsh\n" };
    });

    expect(shell).toBe("/usr/bin/zsh");
    expect(commands).toEqual([["getent", "passwd", "1000"]]);
  });

  it("reads UserShell from the macOS directory service", () => {
    const commands: string[][] = [];
    const shell = readAccountShell("darwin", 501, (command) => {
      commands.push(command);
      return command[0] === "id" ? { exitCode: 0, stdout: "alex\n" } : { exitCode: 0, stdout: "UserShell: /bin/zsh\n" };
    });

    expect(shell).toBe("/bin/zsh");
    expect(commands).toEqual([
      ["id", "-un", "501"],
      ["dscl", ".", "-read", "/Users/alex", "UserShell"],
    ]);
  });

  it("returns null when the user database has no usable entry", () => {
    const failing = () => ({ exitCode: 2, stdout: "" });
    const noShellField = () => ({ exitCode: 0, stdout: "alex:x:1000:1000::/home/alex:\n" });
    const throwing = () => {
      throw new Error("command not found");
    };

    expect(readAccountShell("linux", 1000, failing)).toBeNull();
    expect(readAccountShell("linux", 1000, noShellField)).toBeNull();
    expect(readAccountShell("darwin", 501, failing)).toBeNull();
    expect(readAccountShell("linux", 1000, throwing)).toBeNull();
    expect(readAccountShell("linux", null)).toBeNull();
  });

  it("finds this machine's login shell through the real user database", () => {
    const shell = readAccountShell();

    expect(shell === null || shell.startsWith("/")).toBe(true);
  });
});
