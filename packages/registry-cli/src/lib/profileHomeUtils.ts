import { homedir } from "os";
import { join } from "path";

const PROFILE_HOME_ROOT_SEGMENTS = ["ai-registry"];
const PROFILE_HOMES_DIR_NAME = "profiles";

// Non-default profiles keep their runtime state in a home under the XDG data
// directory, so it survives deleting `.output/` or moving the registry checkout.
export function getProfileHomeDir(harnessTarget: string, profileName: string, environment: NodeJS.ProcessEnv): string {
  const dataHome = environment.XDG_DATA_HOME?.trim() || join(homedir(), ".local", "share");
  return join(dataHome, ...PROFILE_HOME_ROOT_SEGMENTS, harnessTarget, PROFILE_HOMES_DIR_NAME, profileName);
}

// The same location as getProfileHomeDir(), spelled for a generated launcher so
// the shell resolves XDG_DATA_HOME when the launcher runs.
export function getProfileHomeShellPath(harnessTarget: string, profileName: string): string {
  return ["${XDG_DATA_HOME:-$HOME/.local/share}", ...PROFILE_HOME_ROOT_SEGMENTS, harnessTarget, PROFILE_HOMES_DIR_NAME, profileName]
    .join("/");
}
