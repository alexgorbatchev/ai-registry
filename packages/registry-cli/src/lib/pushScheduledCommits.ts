import { isAbsolute } from "node:path";

import type { IScheduledUpdateRunner } from "./pullWithRebase";

function getDestinationHost(destination: string): string {
  if (isAbsolute(destination) || destination.startsWith("./") || destination.startsWith("../")) {
    return "";
  }
  if (destination.includes("://")) {
    const url = new URL(destination);
    if (["https:", "http:", "ssh:", "git:", "file:"].includes(url.protocol)) {
      return url.hostname.toLowerCase();
    }
  } else {
    const host = destination.match(/^(?:[^@/]+@)?([^:/]+):[^:].*$/)?.[1];
    if (host) {
      return host.toLowerCase();
    }
  }
  throw new Error("Cannot determine the push destination; inspect the upstream remote before retrying.");
}

export async function pushScheduledCommits(run: IScheduledUpdateRunner): Promise<boolean> {
  const head = await run(["git", "rev-parse", "HEAD"], true);
  const upstream = await run(["git", "rev-parse", "@{upstream}"], true);
  const range = `${upstream}..${head}`;
  if (await run(["git", "rev-list", "--count", range], true) === "0") {
    return false;
  }

  const branch = await run(["git", "symbolic-ref", "HEAD"], true);
  const tracking = await run([
    "git", "for-each-ref", "--format=%(upstream:remotename)%00%(upstream:remoteref)", branch,
  ], true);
  const [remote, reference] = tracking.split("\0");
  if (!remote || !reference?.startsWith("refs/heads/") || reference.includes("\n")) {
    throw new Error("Cannot determine the upstream push branch; configure one before retrying.");
  }
  const destinations = await run(["git", "remote", "get-url", "--push", "--all", remote], true);
  if (!destinations) {
    throw new Error("Cannot determine the push destination; inspect the upstream remote before retrying.");
  }
  const hosts = destinations.split("\n").map(getDestinationHost);
  if (hosts.some((host) => host === "github.com" || host.endsWith(".github.com"))) {
    const outgoing = await run([
      "git", "log", "--format=%B", "--patch", "--text", "--no-ext-diff", "--no-textconv",
      "--diff-merges=separate", range,
    ], true);
    if (/\b(?:[a-z0-9-]+\.)*(?:cvb|zxc)\.lol\b/i.test(outgoing)) {
      throw new Error("Push blocked: outgoing commits contain private internal domains. Anonymize them before retrying.");
    }
  }
  await run([
    "git", "-c", `remote.${remote}.mirror=false`, "push", "--no-follow-tags", "--recurse-submodules=no",
    "--", remote, `${head}:${reference}`,
  ]);
  return true;
}
