import { parse as parseToml } from "@decimalturn/toml-patch";
import { parse as parseJsonc, printParseErrorCode } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";

import { getErrorMessage } from "../getErrorMessage";
import { isJsonObject } from "./isJsonObject";
import { isJsonValue } from "./isJsonValue";
import type { IJsonObject } from "./types";

function parseTomlText(text: string, filePath: string): unknown {
  try {
    // Copy the null-prototype tables into ordinary objects so they compare equal to
    // the same settings read from JSON.
    return structuredClone(parseToml(text));
  } catch (error) {
    throw new Error(`Cannot sync settings file ${filePath}: ${getErrorMessage(error)}`, { cause: error });
  }
}

function parseJsoncText(text: string, filePath: string): unknown {
  const errors: ParseError[] = [];
  const value: unknown = parseJsonc(text, errors, { allowTrailingComma: true });

  const firstError = errors[0];
  if (firstError) {
    throw new Error(
      `Cannot sync settings file ${filePath}: ${printParseErrorCode(firstError.error)} at offset ${firstError.offset}.`,
    );
  }
  return value;
}

// Reads JSON or JSONC settings, or TOML settings for `.toml` files.
export function parseSettingsText(text: string, filePath: string): IJsonObject {
  const value = filePath.endsWith(".toml") ? parseTomlText(text, filePath) : parseJsoncText(text, filePath);

  if (!isJsonObject(value)) {
    throw new Error(`Cannot sync settings file ${filePath}: the document root must be an object.`);
  }
  if (!isJsonValue(value)) {
    throw new Error(
      `Cannot sync settings file ${filePath}: it contains values JSON cannot represent, such as dates or integers beyond 2^53.`,
    );
  }

  return value;
}
