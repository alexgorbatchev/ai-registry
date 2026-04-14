import { $ } from "bun";
import { readdir, readFile, rm, mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";
import { globby } from "globby";

// Resolve paths relative to the ai-registry root
const REGISTRY_DIR = resolve(import.meta.dir, "..");
const CATALOG_DIR = join(REGISTRY_DIR, "catalog");
const PROFILES_DIR = join(REGISTRY_DIR, "profiles");

// We now build to a single unified directory for OpenCode
const UNIFIED_OPENCODE_DIR = join(REGISTRY_DIR, ".opencode");

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
  console.log("🚀 Building Unified OpenCode Agents...\n");

  // 1. Prepare the unified target directory
  await rm(UNIFIED_OPENCODE_DIR, { recursive: true, force: true });
  await mkdir(UNIFIED_OPENCODE_DIR, { recursive: true });
  
  const rulesyncDir = join(UNIFIED_OPENCODE_DIR, ".rulesync");
  const rulesyncSkillsDir = join(rulesyncDir, "skills");
  const rulesyncCommandsDir = join(rulesyncDir, "commands");
  const agentsOutputDir = join(UNIFIED_OPENCODE_DIR, "agents"); // Write to intermediate agents dir first
  
  await mkdir(rulesyncSkillsDir, { recursive: true });
  await mkdir(rulesyncCommandsDir, { recursive: true });
  await mkdir(agentsOutputDir, { recursive: true });

  // Keep track of what we need to copy to the master catalog
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
    const matchedSkills = manifest.skills ? await resolveGlobs(manifest.skills, join(CATALOG_DIR, "skills")) : [];
    const matchedCommands = manifest.commands ? await resolveGlobs(manifest.commands, join(CATALOG_DIR, "commands")) : [];

    // Add them to the master sets AND the legacy isolated profile folders
    for (const skill of matchedSkills) {
      masterSkills.add(skill);
      await $`cp -R "${join(CATALOG_DIR, "skills", skill)}" "${join(legacyRulesyncDir, "skills", skill)}"`.nothrow().quiet();
    }
    
    for (const cmd of matchedCommands) {
      masterCommands.add(cmd);
      await $`cp -R "${join(CATALOG_DIR, "commands", cmd)}" "${join(legacyRulesyncDir, "commands", cmd)}"`.nothrow().quiet();
    }
    
    // Generate isolated configurations for this profile (ignoring opencode since we unify it)
    try {
      const targets = process.env.RULESYNC_TARGETS || '*';
      const isolatedTargets = targets.split(',').filter(t => t.trim() !== 'opencode').join(',');
      if (isolatedTargets) {
        await $`bunx rulesync generate --targets=${isolatedTargets} --features='*' --simulate-skills --simulate-commands --simulate-subagents`.cwd(profileDir).quiet();
      }
    } catch (e) {}

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
You have been specifically configured with a subset of skills tailored for your role.

Use your \`skill\` tool to load the domain knowledge you need.
`;

    // Save the agent definition into the .rulesync/agents dir so rulesync generate sees it
    await writeFile(join(agentsOutputDir, `${profileName}.md`), agentMd);
  }

  // 3. Copy the unified sets into the rulesync cache
  console.log("\n📚 Assembling global catalog...");
  for (const skill of masterSkills) {
    const sourcePath = join(CATALOG_DIR, "skills", skill);
    await $`cp -R "${sourcePath}" "${join(rulesyncSkillsDir, skill)}"`.nothrow().quiet();
  }
  
  for (const cmd of masterCommands) {
    const sourcePath = join(CATALOG_DIR, "commands", cmd);
    await $`cp -R "${sourcePath}" "${join(rulesyncCommandsDir, cmd)}"`.nothrow().quiet();
  }

  // 4. Run rulesync generate ONCE on the unified directory
  console.log(`\n⚙️  Running rulesync compiler...`);
  try {
    const targets = process.env.RULESYNC_TARGETS || '*';
    await $`bunx rulesync generate --targets=${targets} --features='*' --simulate-skills --simulate-commands --simulate-subagents`.cwd(UNIFIED_OPENCODE_DIR).quiet();
    
    // Rename .opencode to opencode to match XDG standard for testing without symlinks
    try {
      await $`mv ${join(UNIFIED_OPENCODE_DIR, ".opencode")} ${join(UNIFIED_OPENCODE_DIR, "opencode")}`.quiet();
    } catch(e) {}

    // Copy the generated agents into the final opencode output directory manually
    // rulesync generate currently doesn't process `.rulesync/agents` out of the box
    const opencodeAgentDir = join(UNIFIED_OPENCODE_DIR, "opencode", "agent");
    await mkdir(opencodeAgentDir, { recursive: true });
    await $`cp ${agentsOutputDir}/*.md ${opencodeAgentDir}/`.quiet();

    console.log(`   ✅ Successfully compiled OpenCode configuration!`);
  } catch (error: any) {
    console.error(`   ❌ Failed to compile:`);
    if (error.stderr) console.error(error.stderr.toString());
  }

  console.log("\n🎉 Unified configuration ready!");
  console.log("\nTo test this setup instantly via CLI, run:");
  console.log("  XDG_CONFIG_HOME=~/.dotfiles/ai-registry/.opencode opencode --agent designer\n");
  console.log("To activate this setup permanently, symlink the unified output to OpenCode:");
  console.log("  ln -sfn ~/.dotfiles/ai-registry/.opencode/opencode ~/.dotfiles/tools/opencode/config\n");
  console.log("Once activated, you can open OpenCode and use the Tab key to switch between your profiles!");
  
  console.log("\n🥧 For Pi and other tools:");
  console.log("Isolated profile directories are still generated. Symlink them normally:");
  console.log("  ln -sfn ~/.dotfiles/ai-registry/profiles/designer/.agents ~/.dotfiles/tools/pi/config/skills");
}

main().catch(console.error);
