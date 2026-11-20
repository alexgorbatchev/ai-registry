import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export interface Png {
  width: number;
  height: number;
  /** Returns the RGB of one pixel. */
  pixel: (x: number, y: number) => [number, number, number];
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decodes a non-interlaced 8-bit RGB or RGBA PNG, the format browser screenshots use. */
export function readPng(path: string): Png {
  const file = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("latin1", offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, color, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || (color !== 2 && color !== 6) || interlace !== 0)
        throw new Error(`${path}: unsupported PNG (depth ${depth}, color type ${color}, interlace ${interlace})`);
      channels = color === 6 ? 4 : 3;
    } else if (type === "IDAT") data.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const corner = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, corner)][filter];
      pixels[y * stride + x] = (row[x] + predictor) & 0xff;
    }
  }
  return {
    width,
    height,
    pixel: (x, y) => {
      const at = y * stride + x * channels;
      return [pixels[at], pixels[at + 1], pixels[at + 2]];
    },
  };
}

/** The rows, as fractions of the image height, whose middle pixel matches `color` within a small tolerance. */
export function rowsOfColor(png: Png, color: [number, number, number]): { first: number; last: number } | null {
  let first = -1;
  let last = -1;
  for (let y = 0; y < png.height; y++) {
    const pixel = png.pixel(Math.floor(png.width / 2), y);
    if (pixel.every((channel, i) => Math.abs(channel - color[i]) <= 8)) {
      if (first < 0) first = y;
      last = y;
    }
  }
  return first < 0 ? null : { first: first / png.height, last: (last + 1) / png.height };
}
