import { existsSync } from "fs";

import type { IProfileManifest } from "../../../../scripts/lib/harnessBuild";

function hasRecordEntries(value: Record<string, string | boolean | Record<string, string>> | undefined): boolean {
  return value !== undefined && Object.keys(value).length > 0;
}

export function assertSupportedPiManifest(manifest: IProfileManifest, profileName: string): void {
  if (hasRecordEntries(manifest.tools)) {
    throw new Error(`Pi harness does not support manifest.tools yet for profile "${profileName}".`);
  }

  if (hasRecordEntries(manifest.permission)) {
    throw new Error(`Pi harness does not support manifest.permission yet for profile "${profileName}".`);
  }
}

export function assertMissingPiOutputPath(outputPath: string, assetDescription: string): void {
  if (existsSync(outputPath)) {
    throw new Error(`Cannot stage ${assetDescription} because the output path already exists: ${outputPath}`);
  }
}
