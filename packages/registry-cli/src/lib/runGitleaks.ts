import { getErrorMessage } from "./getErrorMessage";

export type GitleaksResult = "clean" | "leaks";

const LEAKS_EXIT_CODE = 99;

// Runs a gitleaks subcommand (`git`, `dir`) quietly: a clean scan prints nothing,
// and findings are printed with their secrets redacted. Scan failures throw, so a
// broken or missing scanner never reads as "clean".
export async function runGitleaks(args: string[], cwd: string): Promise<GitleaksResult> {
  let subprocess: Bun.Subprocess;
  try {
    subprocess = Bun.spawn(
      ["gitleaks", ...args, "--no-banner", "--redact", "--log-level", "warn", "--verbose", "--exit-code", `${LEAKS_EXIT_CODE}`],
      // Pass the environment explicitly: without it Bun resolves `gitleaks` against the
      // PATH captured at startup rather than the current one.
      { cwd, env: process.env, stdin: "ignore", stdout: "inherit", stderr: "inherit" },
    );
  } catch (error) {
    throw new Error(`gitleaks is required to scan for secrets but could not be started: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }

  const exitCode = await subprocess.exited;
  if (exitCode === 0) return "clean";
  if (exitCode === LEAKS_EXIT_CODE) return "leaks";
  throw new Error(`gitleaks ${args.join(" ")} failed with exit code ${exitCode}.`);
}
