#!/usr/bin/env bun
/**
 * Converts CSS color values to Penpot library color fields.
 *
 * Usage:
 *   bun scripts/css-color-to-penpot.ts '<css color>' [...more]
 *
 * Accepts #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() in comma or space syntax, and oklch().
 * Prints one JSON object per input: {"input","color":"#RRGGBB","opacity", "clamped"?}.
 * `clamped` is true when an OKLCH value lies outside sRGB and was clipped.
 * Unsupported inputs print {"input","error"} and make the process exit 1 after all inputs are processed.
 */

type PenpotColor = { input: string; color: string; opacity: number; clamped?: true };
type Failure = { input: string; error: string };

const round = (value: number, digits: number): number => Number(value.toFixed(digits));

function parseNumber(token: string, percentScale: number): number {
  const trimmed = token.trim();
  if (trimmed === "none") {
    return 0;
  }
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg)?$/i.exec(trimmed);
  if (!match) {
    throw new Error(`invalid number "${trimmed}"`);
  }
  const value = Number(match[1]);
  return match[2] === "%" ? (value / 100) * percentScale : value;
}

function splitArguments(body: string): { channels: string[]; alpha?: string } {
  if (body.includes(",")) {
    const parts = body.split(",").map((part) => part.trim());
    return { channels: parts.slice(0, 3), alpha: parts[3] };
  }
  const [channelPart, alphaPart] = body.split("/");
  const channels = channelPart.trim().split(/\s+/);
  return { channels, alpha: alphaPart?.trim() };
}

function toHexByte(unit: number): string {
  return Math.round(Math.min(1, Math.max(0, unit)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

function parseHex(input: string, value: string): PenpotColor {
  const digits = value.slice(1);
  if (!/^[0-9a-f]+$/i.test(digits) || ![3, 4, 6, 8].includes(digits.length)) {
    throw new Error("invalid hex color");
  }
  const expanded = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const opacity = expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  return { input, color: `#${expanded.slice(0, 6).toUpperCase()}`, opacity: round(opacity, 4) };
}

function parseRgb(input: string, body: string): PenpotColor {
  const { channels, alpha } = splitArguments(body);
  if (channels.length !== 3) {
    throw new Error("rgb() needs three channels");
  }
  const units = channels.map((channel) => parseNumber(channel, 255) / 255);
  const opacity = alpha === undefined ? 1 : parseNumber(alpha, 1);
  return { input, color: `#${units.map(toHexByte).join("")}`, opacity: round(opacity, 4) };
}

function parseOklch(input: string, body: string): PenpotColor {
  const { channels, alpha } = splitArguments(body);
  if (channels.length !== 3) {
    throw new Error("oklch() needs three channels");
  }
  const lightness = parseNumber(channels[0], 1);
  const chroma = parseNumber(channels[1], 0.4);
  const hue = (parseNumber(channels[2], 1) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const tolerance = 1e-4;
  const clamped = linear.some((channel) => channel < -tolerance || channel > 1 + tolerance);
  const encoded = linear.map((channel) => {
    const value = Math.min(1, Math.max(0, channel));
    return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  });
  const opacity = alpha === undefined ? 1 : parseNumber(alpha, 1);
  const result: PenpotColor = { input, color: `#${encoded.map(toHexByte).join("")}`, opacity: round(opacity, 4) };
  return clamped ? { ...result, clamped: true } : result;
}

export function convert(input: string): PenpotColor {
  const value = input.trim().toLowerCase();
  if (value.startsWith("#")) {
    return parseHex(input, value);
  }
  const fn = /^(rgba?|oklch)\((.*)\)$/.exec(value);
  if (!fn) {
    throw new Error("unsupported color syntax; resolve var(), calc(), and color-mix() first");
  }
  return fn[1] === "oklch" ? parseOklch(input, fn[2]) : parseRgb(input, fn[2]);
}

if (import.meta.main) {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error("usage: bun scripts/css-color-to-penpot.ts '<css color>' [...more]");
    process.exit(1);
  }
  let failed = false;
  for (const input of inputs) {
    try {
      console.log(JSON.stringify(convert(input)));
    } catch (error) {
      failed = true;
      const failure: Failure = { input, error: error instanceof Error ? error.message : String(error) };
      console.log(JSON.stringify(failure));
    }
  }
  process.exit(failed ? 1 : 0);
}
