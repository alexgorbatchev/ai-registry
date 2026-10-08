import { expect, it } from "bun:test";
import { runCommand } from "../runCommand";

it("captures both streams, exit status, stdin, and an isolated environment", async () => {
  expect(await runCommand([process.execPath, "-e", "console.log(process.env.REVIEW_TEST); console.log(await Bun.stdin.text()); console.error('diagnostic'); process.exitCode = 3;"],
    { REVIEW_TEST: "isolated" }, "input")).toEqual({ code: 3, stdout: "isolated\ninput\n", stderr: "diagnostic\n" });
});

it("closes stdin when no input was provided", async () => {
  expect(await runCommand([process.execPath, "-e", "console.log(await Bun.stdin.text());"], {})).toEqual({ code: 0, stdout: "\n", stderr: "" });
});
