import { existsSync } from "fs";

import type { IProfileManifest } from "../../../lib/harnessBuild";

function hasRecordEntries(value: Record<string, string | boolean | Record<string, string>> | undefined): boolean {
  return value !== undefined && Object.keys(value).length > 0;
}

export function assertSupportedClaudeCodeManifest(manifest: IProfileManifest, profileName: string): void {
  if (hasRecordEntries(manifest.tools)) {
    throw new Error(`Claude Code harness does not support manifest.tools yet for profile "${profileName}".`);
  }

  if (hasRecordEntries(manifest.permission)) {
    throw new Error(`Claude Code harness does not support manifest.permission yet for profile "${profileName}".`);
  }
}

export function assertMissingClaudeCodeOutputPath(outputPath: string, assetDescription: string): void {
  if (existsSync(outputPath)) {
    throw new Error(`Cannot stage ${assetDescription} because the output path already exists: ${outputPath}`);
  }
}
