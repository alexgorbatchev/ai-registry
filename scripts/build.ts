import { $ } from "bun";
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "fs/promises";
import { basename, join, resolve } from "path";
import { existsSync } from "fs";
import { globby } from "globby";

// Resolve paths relative to the ai-registry root
const REGISTRY_DIR = resolve(import.meta.dir, "..");
const SKILLS_DIR = join(REGISTRY_DIR, "skills");
const COMMANDS_DIR = join(REGISTRY_DIR, "commands");
const PROFILES_DIR = join(REGISTRY_DIR, "profiles");
const TEMPLATE_VARIABLE_PATTERN = /{{\s*([a-z0-9_]+)\s*}}/gi;

// We now build unified final outputs into a single directory
const UNIFIED_OUTPUT_DIR = join(REGISTRY_DIR, ".output");
const UNIFIED_TARGETS = new Set(["opencode", "agentsmd"]);
const TEMPLATE_CONTEXT = {
  repo_root: REGISTRY_DIR,
  skills_dir: SKILLS_DIR,
  commands_dir: COMMANDS_DIR,
  profiles_dir: PROFILES_DIR,
  output_dir: UNIFIED_OUTPUT_DIR,
} as const;

function getConfiguredTargets(): string[] {
  return (process.env.RULESYNC_TARGETS || "opencode,agentsmd")
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);
}

function getUnifiedTargets(configuredTargets: string[]): string[] {
  if (configuredTargets.includes("*")) {
    return Array.from(UNIFIED_TARGETS);
  }

  return configuredTargets.filter((target) => UNIFIED_TARGETS.has(target));
}

function getIsolatedTargets(configuredTargets: string[]): string {
  if (configuredTargets.includes("*")) {
    return "*";
  }

  return configuredTargets.filter((target) => !UNIFIED_TARGETS.has(target)).join(",");
}

function hasStderr(error: unknown): error is { stderr: { toString(): string } } {
  return typeof error === "object" && error !== null && "stderr" in error;
}

function applyTemplateVariables(
  content: string,
  sourcePath: string,
  templateContext: Record<string, string>,
): string {
  const placeholders = Array.from(
    new Set(content.match(TEMPLATE_VARIABLE_PATTERN) ?? []),
  );

  if (placeholders.length === 0) {
    return content;
  }

  const unknownKeys = placeholders
    .map((placeholder) => placeholder.replace(/[{}\s]/g, ""))
    .filter((key) => !(key in templateContext));

  if (unknownKeys.length > 0) {
    throw new Error(
      `Unknown template variable(s) in ${sourcePath}: ${unknownKeys.join(", ")}`,
    );
  }

  return content.replace(TEMPLATE_VARIABLE_PATTERN, (_, key: string) => {
    return templateContext[key] ?? _;
  });
}

async function copyDirectoryWithTemplateVariables(
  sourceDir: string,
  targetDir: string,
  templateContext: Record<string, string>,
): Promise<void> {
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryWithTemplateVariables(
        sourcePath,
        targetPath,
        templateContext,
      );
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const isSkillDefinition = basename(sourcePath) === "SKILL.md";
    if (isSkillDefinition) {
      const sourceContent = await readFile(sourcePath, "utf-8");
      await writeFile(
        targetPath,
        applyTemplateVariables(sourceContent, sourcePath, templateContext),
        "utf-8",
      );
    } else {
      await copyFile(sourcePath, targetPath);
    }

    const sourceStats = await stat(sourcePath);
    await chmod(targetPath, sourceStats.mode);
  }
}

async function applyTemplateVariablesToGeneratedOutput(
  outputDir: string,
  templateContext: Record<string, string>,
): Promise<void> {
  if (!existsSync(outputDir)) {
    return;
  }

  const entries = await readdir(outputDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(outputDir, entry.name);

    if (entry.isDirectory()) {
      await applyTemplateVariablesToGeneratedOutput(entryPath, templateContext);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileBuffer = await readFile(entryPath);
    if (fileBuffer.includes(0)) {
      continue;
    }

    const sourceContent = fileBuffer.toString("utf-8");
    const renderedContent = applyTemplateVariables(
      sourceContent,
      entryPath,
      templateContext,
    );

    if (renderedContent !== sourceContent) {
      await writeFile(entryPath, renderedContent, "utf-8");
    }
  }
}

async function resolveGlobs(patterns: string[], cwd: string): Promise<string[]> {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) return [];
  const matches = await globby(patterns, {
    cwd,
    onlyFiles: false,
    markDirectories: false,
    expandDirectories: false,
  });
  return matches;
}

async function main() {
  console.log("🚀 Building Unified Agent Outputs...\n");

  const configuredTargets = getConfiguredTargets();
  const unifiedTargets = getUnifiedTargets(configuredTargets);

  // 1. Prepare the unified target directory
  await rm(UNIFIED_OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UNIFIED_OUTPUT_DIR, { recursive: true });
  
  const rulesyncDir = join(UNIFIED_OUTPUT_DIR, ".rulesync");
  const rulesyncSkillsDir = join(rulesyncDir, "skills");
  const rulesyncCommandsDir = join(rulesyncDir, "commands");
  const opencodeAgentStagingDir = join(UNIFIED_OUTPUT_DIR, ".opencode-agents");
  
  await mkdir(rulesyncSkillsDir, { recursive: true });
  await mkdir(rulesyncCommandsDir, { recursive: true });
  await mkdir(opencodeAgentStagingDir, { recursive: true });

  // Keep track of what we need to copy into the shared build inputs
  const masterSkills = new Set<string>();
  const masterCommands = new Set<string>();

  const profiles = await readdir(PROFILES_DIR, { withFileTypes: true });

  // We need to keep generating isolated .rulesync directories per-profile for legacy/other tools like Pi
  for (const dirent of profiles) {
    if (!dirent.isDirectory()) continue;

    const profileName = dirent.name;
    const profileDir = join(PROFILES_DIR, profileName);
    
    // Check for either json or yaml
    const hasJson = existsSync(join(profileDir, "profile.json"));
    const hasYaml = existsSync(join(profileDir, "profile.yaml"));

    if (!hasJson && !hasYaml) continue;

    console.log(`📦 Processing persona: ${profileName}`);
    let manifest;

    // Support both .yaml and .json files natively using Bun
    const yamlPath = join(profileDir, "profile.yaml");
    const jsonPath = join(profileDir, "profile.json");

    if (existsSync(yamlPath)) {
      // Bun natively parses YAML on dynamic import
      const module = await import(yamlPath);
      manifest = module.default;
    } else if (existsSync(jsonPath)) {
      const manifestContent = await readFile(jsonPath, "utf-8");
      manifest = JSON.parse(manifestContent);
    } else {
      console.warn(`   ⚠️ Skipping: Neither profile.yaml nor profile.json found.`);
      continue;
    }

    // Clean out old generated directories for this profile (for non-OpenCode targets)
    const items = await readdir(profileDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && item.name.startsWith('.') && item.name !== '.rulesync') {
        await rm(join(profileDir, item.name), { recursive: true, force: true });
      }
    }

    // Ensure we still build isolated outputs for legacy targets like Pi
    const legacyRulesyncDir = join(profileDir, ".rulesync");
    await rm(legacyRulesyncDir, { recursive: true, force: true });
    await mkdir(join(legacyRulesyncDir, "skills"), { recursive: true });
    await mkdir(join(legacyRulesyncDir, "commands"), { recursive: true });

    // Resolve skills and commands for THIS profile
    const matchedSkills = manifest.skills ? await resolveGlobs(manifest.skills, SKILLS_DIR) : [];
    const matchedCommands = manifest.commands ? await resolveGlobs(manifest.commands, COMMANDS_DIR) : [];

    // Add them to the master sets AND the legacy isolated profile folders
    for (const skill of matchedSkills) {
      masterSkills.add(skill);
      await copyDirectoryWithTemplateVariables(
        join(SKILLS_DIR, skill),
        join(legacyRulesyncDir, "skills", skill),
        TEMPLATE_CONTEXT,
      );
    }
    
    for (const cmd of matchedCommands) {
      masterCommands.add(cmd);
      await $`cp -R "${join(COMMANDS_DIR, cmd)}" "${join(legacyRulesyncDir, "commands", cmd)}"`.nothrow().quiet();
    }
    
    // Generate isolated configurations for this profile. Shared unified targets are built in .output.
    try {
      const isolatedTargets = getIsolatedTargets(configuredTargets);
      if (isolatedTargets) {
        await $`bun run rulesync generate --targets=${isolatedTargets} --features='*' --simulate-skills --simulate-commands --simulate-subagents`.cwd(profileDir).quiet();

        const generatedProfileOutputs = await readdir(profileDir, {
          withFileTypes: true,
        });
        for (const item of generatedProfileOutputs) {
          if (
            item.isDirectory() &&
            item.name.startsWith(".") &&
            item.name !== ".rulesync"
          ) {
            await applyTemplateVariablesToGeneratedOutput(
              join(profileDir, item.name),
              TEMPLATE_CONTEXT,
            );
          }
        }
      }
    } catch (error) {}

    // Generate the OpenCode Agent Markdown
    // We restrict skill access to ONLY the skills defined in this profile
    let agentMd = `---
description: Auto-generated agent persona for the ${profileName} profile
mode: primary
`;

    // 1. Inject tool toggles if defined in profile.json
    if (manifest.tools && typeof manifest.tools === "object") {
      agentMd += `tools:\n`;
      for (const [toolName, isEnabled] of Object.entries(manifest.tools)) {
        agentMd += `  ${toolName}: ${isEnabled}\n`;
      }
    }

    // 2. Inject permissions (start with skills)
    agentMd += `permission:\n  skill:\n    "*": deny\n`;
    for (const skill of matchedSkills) {
      agentMd += `    "${skill}": allow\n`;
    }

    // 3. Inject any custom permissions defined in profile.json
    if (manifest.permission && typeof manifest.permission === "object") {
      for (const [permKey, permValue] of Object.entries(manifest.permission)) {
        // Skip 'skill' since we already manage it tightly above
        if (permKey === "skill") continue; 
        
        agentMd += `  ${permKey}:\n`;
        if (typeof permValue === "object" && permValue !== null) {
          for (const [pattern, action] of Object.entries(permValue)) {
            agentMd += `    "${pattern}": ${action}\n`;
          }
        } else {
          agentMd += `    "*": ${permValue}\n`;
        }
      }
    }
    
    agentMd += `---
You are the **${profileName.toUpperCase()}** agent. 

${manifest.system_prompt ? manifest.system_prompt : 'You have been specifically configured with a subset of skills tailored for your role.'}

Use your \`skill\` tool to load the domain knowledge you need.
`;

    // Stage the agent definition until the final OpenCode output exists
    await writeFile(join(opencodeAgentStagingDir, `${profileName}.md`), agentMd);
  }

  // 3. Copy the unified sets into the rulesync cache
  console.log("\n📚 Assembling shared assets...");
  for (const skill of masterSkills) {
    const sourcePath = join(SKILLS_DIR, skill);
    await copyDirectoryWithTemplateVariables(
      sourcePath,
      join(rulesyncSkillsDir, skill),
      TEMPLATE_CONTEXT,
    );
  }
  
  for (const cmd of masterCommands) {
    const sourcePath = join(COMMANDS_DIR, cmd);
    await $`cp -R "${sourcePath}" "${join(rulesyncCommandsDir, cmd)}"`.nothrow().quiet();
  }

  // 4. Run rulesync generate ONCE on the unified directory
  console.log(`\n⚙️  Running rulesync compiler...`);
  try {
    if (unifiedTargets.length > 0) {
      await $`bun run rulesync generate --targets=${unifiedTargets.join(",")} --features='*' --simulate-skills --simulate-commands --simulate-subagents`.cwd(UNIFIED_OUTPUT_DIR).quiet();
    }
    
    if (unifiedTargets.includes("opencode")) {
      // Rename .opencode to opencode to match XDG standard for testing without symlinks
      try {
        await rename(join(UNIFIED_OUTPUT_DIR, ".opencode"), join(UNIFIED_OUTPUT_DIR, "opencode"));
      } catch (error) {}

      // Copy the generated agents into the final opencode output directory manually
      // rulesync generate currently doesn't process OpenCode agent personas out of the box
      const opencodeAgentDir = join(UNIFIED_OUTPUT_DIR, "opencode", "agent");
      await mkdir(opencodeAgentDir, { recursive: true });
      await $`cp ${opencodeAgentStagingDir}/*.md ${opencodeAgentDir}/`.quiet();
    }

    const generatedAgentsRulePath = join(UNIFIED_OUTPUT_DIR, "AGENTS.md");
    const generatedAgentsToolPath = join(UNIFIED_OUTPUT_DIR, ".agents");
    const sourceAgentsRulePath = join(REGISTRY_DIR, "AGENTS.md");
    if (unifiedTargets.includes("agentsmd") && (existsSync(generatedAgentsRulePath) || existsSync(generatedAgentsToolPath) || existsSync(sourceAgentsRulePath))) {
      const agentsOutputDir = join(UNIFIED_OUTPUT_DIR, "agents");
      await mkdir(agentsOutputDir, { recursive: true });

      if (existsSync(generatedAgentsRulePath)) {
        await rename(generatedAgentsRulePath, join(agentsOutputDir, "AGENTS.md"));
      } else if (existsSync(sourceAgentsRulePath)) {
        await writeFile(join(agentsOutputDir, "AGENTS.md"), await readFile(sourceAgentsRulePath, "utf-8"));
      }

      if (existsSync(generatedAgentsToolPath)) {
        await rename(generatedAgentsToolPath, join(agentsOutputDir, ".agents"));
      }
    }

    if (unifiedTargets.includes("opencode")) {
      // Look for global harness configuration files (e.g., opencode.jsonc) and inject them
      const globalConfigPath = join(REGISTRY_DIR, "harnesses");
      if (existsSync(globalConfigPath)) {
        const harnessConfigs = await readdir(globalConfigPath, {
          withFileTypes: true,
        });
        for (const configItem of harnessConfigs) {
          // e.g. /harnesses/opencode/opencode.jsonc -> .output/opencode/opencode.jsonc
          if (configItem.isDirectory()) {
            const sourceHarnessFolder = join(globalConfigPath, configItem.name);
            const targetHarnessFolder = join(UNIFIED_OUTPUT_DIR, configItem.name);
            if (existsSync(targetHarnessFolder)) {
              await $`cp -R ${sourceHarnessFolder}/* ${targetHarnessFolder}/`
                .nothrow()
                .quiet();
            }
          }
        }
      }
    }

    await applyTemplateVariablesToGeneratedOutput(
      UNIFIED_OUTPUT_DIR,
      TEMPLATE_CONTEXT,
    );

    console.log(`   ✅ Successfully compiled unified outputs!`);
  } catch (error) {
    console.error(`   ❌ Failed to compile:`);
    if (hasStderr(error) && error.stderr.toString().trim()) {
      console.error(error.stderr.toString());
    } else if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
  } finally {
    // Keep .output limited to final harness outputs.
    await rm(rulesyncDir, { recursive: true, force: true });
    await rm(opencodeAgentStagingDir, { recursive: true, force: true });
  }

  console.log("\n🎉 Unified configuration ready!");
  console.log("\nTo test this setup instantly via CLI, run:");
  console.log("  XDG_CONFIG_HOME=~/.dotfiles/ai-registry/.output opencode --agent designer\n");
  console.log("To apply the generated outputs to your machine, run:");
  console.log("  bun run bootstrap\n");
  console.log("Once activated, you can open OpenCode and use the Tab key to switch between your profiles!");
  
  console.log("\n🥧 For Pi and other tools:");
  console.log("Isolated profile directories are still generated. Symlink them normally:");
  console.log("  ln -sfn ~/.dotfiles/ai-registry/profiles/designer/.agents ~/.dotfiles/tools/pi/config/skills");
}

main().catch(console.error);
