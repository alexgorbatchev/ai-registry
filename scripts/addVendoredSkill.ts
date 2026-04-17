import { $ } from "bun";
import { resolve } from "path";

const REGISTRY_DIR = resolve(import.meta.dir, "..");

type IParsedAddCommand = {
  source: string;
  skillNames: string[];
};

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let currentToken = "";
  let quote: '"' | "'" | null = null;
  let isEscaping = false;

  for (const character of command) {
    if (isEscaping) {
      currentToken += character;
      isEscaping = false;
      continue;
    }

    if (character === "\\") {
      isEscaping = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        currentToken += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }
      continue;
    }

    currentToken += character;
  }

  if (isEscaping) {
    currentToken += "\\";
  }

  if (quote) {
    throw new Error(`Unterminated quoted string in command: ${command}`);
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  return tokens;
}

function getRawCommand(): string {
  const rawCommand = process.argv.slice(2).join(" ").trim();
  if (!rawCommand) {
    throw new Error(
      "Missing command. Example: bun run skills:add 'npx skills add https://github.com/shadcn/ui --skill shadcn'",
    );
  }

  return rawCommand;
}

function stripAddPrefix(tokens: string[]): string[] {
  if (tokens[0] === "npx" && tokens[1] === "skills" && tokens[2] === "add") {
    return tokens.slice(3);
  }

  if (tokens[0] === "skills" && tokens[1] === "add") {
    return tokens.slice(2);
  }

  return tokens;
}

function parseAddCommand(command: string): IParsedAddCommand {
  const tokens = stripAddPrefix(tokenizeCommand(command));
  const skillNames: string[] = [];
  let source: string | null = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "--skill" || token === "-s") {
      const skillName = tokens[index + 1];
      if (!skillName) {
        throw new Error(`Missing value for ${token}`);
      }

      skillNames.push(skillName);
      index += 1;
      continue;
    }

    if (token === "--agent" || token === "-a" || token === "--copy" || token === "-y" || token === "--yes") {
      throw new Error(
        `${token} is managed automatically by bun run skills:add. Pass only the original source and --skill options.`,
      );
    }

    if (token === "--global" || token === "-g" || token === "--all" || token === "--list" || token === "-l") {
      throw new Error(`${token} is not supported by bun run skills:add.`);
    }

    if (token.startsWith("-")) {
      throw new Error(`Unsupported option for bun run skills:add: ${token}`);
    }

    if (source) {
      throw new Error(`Unexpected extra positional argument: ${token}`);
    }

    source = token;
  }

  if (!source) {
    throw new Error("Missing source in skills add command.");
  }

  if (skillNames.length === 0) {
    throw new Error("bun run skills:add requires at least one --skill <name> option.");
  }

  return {
    source,
    skillNames,
  };
}

async function main(): Promise<void> {
  const rawCommand = getRawCommand();
  const parsedCommand = parseAddCommand(rawCommand);

  console.log(`Vendoring ${parsedCommand.skillNames.length} external skill(s) from ${parsedCommand.source}...`);

  for (const skillName of parsedCommand.skillNames) {
    console.log(`\nAdding ${skillName}`);
    await $`npx skills add ${parsedCommand.source} --skill ${skillName} -a openclaw --copy -y`.cwd(REGISTRY_DIR);
  }

  console.log("\nRebuilding generated outputs...");
  await $`bun run build`.cwd(REGISTRY_DIR);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
