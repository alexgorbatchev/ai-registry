#!/usr/bin/env bun
import { Command, type Help } from "commander";
import skill from "../SKILL.md" with { type: "text" };
import { createReviewerApi } from "./createReviewerApi";
import { ensureReviewer } from "./ensureReviewer";
import { listOpenIssues } from "./listOpenIssues";
import { loadReviewerConfig, type IReviewerFlags } from "./loadReviewerConfig";

const agentMode = ["1", "true", "yes"].includes(process.env.AGENT ?? "");
const program = new Command("reviewer").description("Ensure a GitHub reviewer bot has access and list open issues.");
program.command("skill").description("Print the bundled skill verbatim.").action(async () => {
  await Bun.write(Bun.stdout, skill);
});
const access = program.command("access").description("Manage reviewer access.");
const ensure = access.command("ensure").description("Verify identities, invite and accept when missing, then list issues.")
  .option("--repo <owner/repo>", "Repository (default: current checkout).")
  .option("--reviewer <login>", "Expected bot login (default: environment or Git config).")
  .option("--token-env <name>", "Environment variable containing its token (default: environment or Git config).")
  .option("--hostname <host>", "GitHub hostname (default: GH_HOST or github.com).")
  .option("--pr <number>", "Also require the bot to differ from this PR author.")
  .option("--no-issues", "Skip listing open issues after access verification.")
  .action(async () => {
    const config = await loadReviewerConfig(ensure.opts<IReviewerFlags>(), process.env);
    const api = createReviewerApi({ hostname: config.hostname, token: config.token, environment: process.env });
    const result = await ensureReviewer(config, api);
    // Emit verified access before listing so a listing failure cannot hide an accepted invitation.
    const accessStatus = `Reviewer ${result.reviewer}: ${result.access} on ${result.repo}`;
    if (agentMode) console.error(`OK: ${accessStatus}`);
    else console.log(accessStatus);
    const issues = config.issues ? await listOpenIssues(config.repo, api) : undefined;
    if (agentMode) {
      console.log(JSON.stringify({ ...result, issues }));
    } else {
      console.log(result.author ? `PR author: ${result.author} (distinct)` : "PR author: not checked; pass --pr before review submission.");
      for (const issue of issues ?? []) console.log(`${issue.createdAt}  #${issue.number}  ${Bun.stripANSI(issue.title).replaceAll(/[\x00-\x1f\x7f]/g, " ")}\n${issue.url}`);
      if (issues?.length === 0) console.log("No open issues.");
    }
  });

function helpTree(command: Command, helper: Help, prefix = ""): string[] {
  const commands = helper.visibleCommands(command);
  return commands.flatMap((child, index) => {
    const last = index === commands.length - 1;
    const marker = agentMode ? "- " : last ? "╰─ " : "├─ ";
    const term = `${prefix}${marker}${helper.subcommandTerm(child)}`;
    return [`${agentMode ? term : term.padEnd(32)}  ${child.description()}`,
      ...helpTree(child, helper, prefix + (agentMode || last ? "  " : "│ "))];
  });
}
for (const command of [program, access, ensure, ...program.commands.filter(child => child.name() === "skill")]) {
  command.configureHelp({ formatHelp: (cmd, helper) => {
    const lines = [`Usage: ${helper.commandUsage(cmd)}`, cmd.description(), ...helpTree(cmd, helper),
      ...helper.visibleOptions(cmd).map(option => `${option.flags}  ${option.description}`)];
    if (agentMode) return ["ALERT: Agents must read `AGENT=1 reviewer skill` before using this tool.", ...lines].join("\n") + "\n";
    const width = process.stdout.columns || 100;
    return lines.map(line => Bun.stringWidth(line) > width ? `${Bun.wrapAnsi(line, Math.max(1, width - 1), { hard: true }).split("\n")[0]}…` : line).join("\n") + "\n";
  } });
}
try {
  await program.parseAsync();
} catch (error) {
  // Never print captured subprocess output, credentials, or the options/config object.
  console.error(`ERR: ${error instanceof Error ? error.message : "Reviewer setup failed."}`);
  process.exitCode = 1;
}
