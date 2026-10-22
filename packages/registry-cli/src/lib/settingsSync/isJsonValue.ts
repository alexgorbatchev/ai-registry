import type { JsonValue } from "./types";

// Rejects values a settings file can parse into but JSON cannot represent, such
// as TOML dates or integers beyond the safe-integer range.
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item));
  if (typeof value !== "object") return false;
  // TOML tables parse into null-prototype objects; dates and other classes are rejected.
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every((item) => isJsonValue(item));
}
