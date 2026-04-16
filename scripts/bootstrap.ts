import { $ } from "bun";
import { mkdir, rm, symlink } from "fs/promises";
import { dirname, join, resolve } from "path";

const REGISTRY_DIR = resolve(import.meta.dir, "..");
const OUTPUT_DIR = join(REGISTRY_DIR, ".output");

type IBootstrapTarget = {
  name: string;
  envName: string;
  sourcePath: string;
  targetPath: string | null;
};

function getBootstrapTargets(): IBootstrapTarget[] {
  return [
    {
      name: "opencode",
      envName: "OPENCODE_CONFIG_DIR",
      sourcePath: join(OUTPUT_DIR, "opencode"),
      targetPath: process.env.OPENCODE_CONFIG_DIR?.trim() || null,
    },
    {
      name: "agents",
      envName: "AGENTS_BUNDLE_DIR",
      sourcePath: join(OUTPUT_DIR, "agents"),
      targetPath: process.env.AGENTS_BUNDLE_DIR?.trim() || null,
    },
  ];
}

async function applyTarget(target: IBootstrapTarget): Promise<void> {
  if (!target.targetPath) {
    return;
  }

  await mkdir(dirname(target.targetPath), { recursive: true });
  await rm(target.targetPath, { recursive: true, force: true });
  await symlink(target.sourcePath, target.targetPath, "dir");
}

async function main(): Promise<void> {
  console.log("🚀 Bootstrapping ai-registry...\n");

  await $`bun run build`.cwd(REGISTRY_DIR);

  const bootstrapTargets = getBootstrapTargets();
  const configuredTargets = bootstrapTargets.filter((target) => target.targetPath);

  if (configuredTargets.length === 0) {
    console.log("No bootstrap targets configured.");
    console.log("Set one or more of these environment variables to apply symlinks:");
    for (const target of bootstrapTargets) {
      console.log(`  ${target.envName}`);
    }
    console.log("\nExamples:");
    console.log('  OPENCODE_CONFIG_DIR="$XDG_CONFIG_HOME/opencode" bun run bootstrap');
    console.log('  AGENTS_BUNDLE_DIR="$HOME/.local/share/agents-bundle" bun run bootstrap');
    return;
  }

  console.log("Applying configured bootstrap targets...");
  for (const target of configuredTargets) {
    await applyTarget(target);
    console.log(`  linked ${target.name}: ${target.targetPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
