import type { IJsonObject } from "./types";

export function isJsonObject(value: unknown): value is IJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
