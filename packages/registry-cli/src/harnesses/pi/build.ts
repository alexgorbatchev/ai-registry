import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import type { IBootstrapTarget, IHarnessBuildContext, IUnifiedHarnessPlugin } from "../../lib/harnessBuild";
import { logHarnessSkillOverrides } from "../../lib/logHarnessSkillOverrides";
import {
  getOutputSkillName,
  injectDisableModelInvocation,
  parseSkillAuthor,
  readHarnessSkillEntries,
  updateSkillName,
} from "../../lib/userSkillUtils";

const APPEND_SYSTEM_FILE_NAME = "APPEND_SYSTEM.md";
const PI_OUTPUT_DIR_NAME = "pi";

async function stageHarnessLocalSkills(context: IHarnessBuildContext, skillsDir: string): Promise<void> {
  const harnessSkillsDir = join(context.harnessDir, "skills");
  if (!existsSync(harnessSkillsDir)) {
    return;
  }

  const harnessSkillEntries = await readHarnessSkillEntries(harnessSkillsDir);
  for (const harnessSkillEntry of harnessSkillEntries) {
    const skillFilePath = join(harnessSkillEntry.sourcePath, "SKILL.md");
    let skillAuthor: string | null = null;
    if (existsSync(skillFilePath)) {
      const content = await readFile(skillFilePath, "utf-8");
      skillAuthor = parseSkillAuthor(content);
    }
    const outputSkillName = getOutputSkillName(harnessSkillEntry.name, skillAuthor);
    const outputPath = join(skillsDir, outputSkillName);
    if (existsSync(outputPath)) {
      await rm(outputPath, { recursive: true, force: true });
    }

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      harnessSkillEntry.sourcePath,
      outputPath,
      context.templateContext,
    );

    const generatedSkillFilePath = join(outputPath, "SKILL.md");
    if (existsSync(generatedSkillFilePath)) {
      let content = await readFile(generatedSkillFilePath, "utf-8");
      if (outputSkillName !== harnessSkillEntry.name) {
        content = updateSkillName(content, outputSkillName);
      }
      if (harnessSkillEntry.isUser) {
        content = injectDisableModelInvocation(content);
      }
      await writeFile(generatedSkillFilePath, content, "utf-8");
    }
  }
}

async function generatePiHelpers(context: IHarnessBuildContext): Promise<void> {
  for (const helperName of ["pi-install", "pi-uninstall", "pi-update"]) {
    const template = await readFile(join(context.harnessDir, "templates", `${helperName}.sh`), "utf-8");
    await context.buildSupport.writeBinScript(context.outputDir, helperName, template);
  }
}

async function copyOptionalHarnessPath(context: IHarnessBuildContext, piOutputDir: string, name: string): Promise<void> {
  const sourcePath = join(context.harnessDir, name);
  if (existsSync(sourcePath)) {
    await context.buildSupport.copyPathWithTemplateVariables(sourcePath, join(piOutputDir, name), context.templateContext);
  }
}

async function buildOutput(context: IHarnessBuildContext): Promise<void> {
  const piOutputDir = join(context.outputDir, PI_OUTPUT_DIR_NAME);
  const skillsDir = join(piOutputDir, "skills");
  const promptsDir = join(piOutputDir, "prompts");

  await mkdir(skillsDir, { recursive: true });
  await context.buildSupport.copyPathWithTemplateVariables(
    context.systemPromptPath,
    join(piOutputDir, APPEND_SYSTEM_FILE_NAME),
    context.templateContext,
  );

  await stageHarnessLocalSkills(context, skillsDir);
  await context.buildSupport.stageRegistryAssets(context, { commandsDir: promptsDir, skillsDir });
  await context.buildSupport.mergeDirectory(join(context.harnessDir, "prompts"), promptsDir);

  const settingsPath = join(piOutputDir, "settings.json");
  await context.buildSupport.copyPathWithTemplateVariables(
    join(context.harnessDir, "settings.json"),
    settingsPath,
    context.templateContext,
  );
  // Pi saves model, theme, and thinking-level choices here and stamps the
  // last-seen version after every update; only the preferences sync back.
  context.buildSupport.syncSettingsFile(settingsPath, { liveOnlyKeyPaths: [["lastChangelogVersion"]] });
  await copyOptionalHarnessPath(context, piOutputDir, "models.json");
  await copyOptionalHarnessPath(context, piOutputDir, "web-search.json");
  await copyOptionalHarnessPath(context, piOutputDir, "extensions");

  await generatePiHelpers(context);
  await logHarnessSkillOverrides(context, "pi");
}

async function getBootstrapTargets(outputDir: string): Promise<IBootstrapTarget[]> {
  const sourcePath = join(outputDir, PI_OUTPUT_DIR_NAME);
  const targets: IBootstrapTarget[] = [
    {
      kind: "home",
      sourcePath,
      targetPath: process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent"),
      description: "Pi config",
    },
  ];

  const webSearchSource = join(sourcePath, "web-search.json");
  if (existsSync(webSearchSource)) {
    targets.push({
      kind: "link",
      sourcePath: webSearchSource,
      targetPath: join(homedir(), ".pi", "web-search.json"),
      description: "Pi web search config",
    });
  }

  return targets;
}

const plugin: IUnifiedHarnessPlugin = {
  target: PI_OUTPUT_DIR_NAME,
  buildOutput,
  getBootstrapTargets,
};

export default plugin;
