import { expect, test } from "bun:test";
import type { Runner } from "../herdr";
import { readT3Thread, t3AppLink } from "../t3";

const HOSTED = "https://app.t3.codes/threads/ded656bc-3e4c-42b3-be26-65fb25c7f480/ab49f601-7254";
const APP = "t3code://threads/ded656bc-3e4c-42b3-be26-65fb25c7f480/ab49f601-7254";

const T3 = { T3CODE_THREAD_ID: "ab49f601-7254", T3CODE_CLI_PATH: "/home/me/.t3/bin/t3" };

/** Answer `t3 thread show` with `thread`, recording every call. */
function threadRunner(thread: unknown, calls: string[][] = []): Runner {
  return async (argv) => {
    calls.push(argv);
    return JSON.stringify({ thread, messages: [] });
  };
}

test("turns a hosted thread link into the desktop app's link", () => {
  expect(t3AppLink(HOSTED)).toBe(APP);
  expect(t3AppLink(`${HOSTED}/`)).toBe(APP);
  expect(t3AppLink("https://app.t3.codes/threads/only-one")).toBeUndefined();
  expect(t3AppLink("https://app.t3.codes/new")).toBeUndefined();
  expect(t3AppLink("not a url")).toBeUndefined();
});

test("reads the session's thread through the CLI T3 names", async () => {
  const calls: string[][] = [];
  expect(await readT3Thread(T3, threadRunner({ title: "  Fix hooks ", link: HOSTED }, calls))).toEqual({
    title: "Fix hooks",
    appLink: APP,
  });
  expect(calls).toEqual([["/home/me/.t3/bin/t3", "thread", "show", "ab49f601-7254", "--json", "--messages", "0"]]);
});

test("falls back to t3 on PATH and keeps a thread missing its title or link", async () => {
  const calls: string[][] = [];
  expect(await readT3Thread({ T3CODE_THREAD_ID: "x" }, threadRunner({ title: " " }, calls))).toEqual({
    title: undefined,
    appLink: undefined,
  });
  expect(calls[0]?.[0]).toBe("t3");
});

test("reads no thread outside T3 or when the server cannot supply one", async () => {
  expect(await readT3Thread({}, threadRunner({ title: "x", link: HOSTED }))).toBeUndefined();
  expect(await readT3Thread(T3, async () => undefined)).toBeUndefined();
  expect(await readT3Thread(T3, async () => "not json")).toBeUndefined();
  expect(await readT3Thread(T3, threadRunner(null))).toBeUndefined();
  expect(await readT3Thread(T3, async () => "{}")).toBeUndefined();
});
