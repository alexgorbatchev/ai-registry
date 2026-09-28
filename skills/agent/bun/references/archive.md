# Bun Archive, Tar, & Gzip Client Reference (`Bun.Archive`)

Do not import heavy external npm packages (like `tar`, `archiver`, or `pako`) for creating or extracting tarballs, or performing Gzip/Zstandard compression. Bun provides high-performance native implementations in Zig.

---

## 1. Creating Tar Archives (`Bun.Archive`)
Create an archive from an in-memory object mapping file paths to file contents. Uncompressed by default.
- **Allowed types for contents**: `string`, `Blob`, `Uint8Array`, `ArrayBuffer`.

```ts
import { Archive } from "bun";

const archive = new Archive({
  "README.md": "# Project Title\n",
  "src/index.ts": "console.log('Main Entry');\n",
  "assets/logo.png": logoUint8Array, // raw bytes
});

// 1. Write uncompressed tar to disk
await Bun.write("project.tar", archive);

// 2. Write compressed tar.gz to disk (using compression options)
const gzippedArchive = new Archive(
  { "hello.txt": "Hello!" }, 
  { compress: "gzip", level: 9 } // gzip level 1-12 (default: 6)
);
await Bun.write("project.tar.gz", gzippedArchive);
```

---

## 2. Extracting Tarballs to Disk (`.extract`)
Extract tar or gzipped tar archives recursively to disk. Bun automatically handles `.tar` and `.tar.gz` (gzip is detected automatically).
```ts
const tarballBytes = await Bun.file("release.tar.gz").bytes();
const archive = new Archive(tarballBytes);

// Extract all contents recursively to directory (created automatically if missing)
const extractedCount = await archive.extract("./dest");
console.log(`Extracted ${extractedCount} entries (files, folders, and symlinks).`);
```

### Filtering Extracted Content with Globs
Use glob patterns to extract only subset files. Match paths are always normalized to use forward slashes (`/`).
```ts
// Extract only TS/JS files
await archive.extract("./dest", { glob: "**/*.{ts,js}" });

// Extract src directory but exclude tests (negative patterns prefix with '!')
await archive.extract("./dest", {
  glob: ["src/**", "!**/*.test.ts", "!**/__tests__/**"],
});
```

---

## 3. Reading Archives In-Memory (`.files()`)
Enumerate and read file contents within an archive without writing them to disk.
```ts
const archive = new Archive(await Bun.file("data.tar").bytes());
const filesMap = await archive.files(); // returns Map<string, File>

for (const [path, file] of filesMap) {
  console.log(`File path inside tar: ${path}`);
  console.log(`Size: ${file.size} bytes`);
  console.log(`Contents: ${await file.text()}`);
}

// Filter file enumeration using globs
const tsFilesMap = await archive.files("**/*.ts");
```

---

## 4. Native Gzip, Deflate, & Zstandard Compression
For compression tasks outside of tar archiving, use Bun's built-in zlib and Zstandard algorithms.

### Gzip & Deflate (zlib)
```ts
const rawBuffer = Buffer.from("data".repeat(100));

// 1. Gzip Compression & Decompression
const compressedGzip = Bun.gzipSync(rawBuffer);
const decompressedGzip = Bun.gunzipSync(compressedGzip);

// 2. Raw Deflate Compression & Decompression
const compressedDeflate = Bun.deflateSync(rawBuffer);
const decompressedDeflate = Bun.inflateSync(compressedDeflate);
```

### Zstandard (Zstd)
```ts
const rawBuffer = Buffer.from("data".repeat(100));

// Synchronous Zstd (levels 1-22, default: 3)
const zstdCompressedSync = Bun.zstdCompressSync(rawBuffer, { level: 6 });
const zstdDecompressedSync = Bun.zstdDecompressSync(zstdCompressedSync);

// Asynchronous Zstd
const zstdCompressedAsync = await Bun.zstdCompress(rawBuffer);
const zstdDecompressedAsync = await Bun.zstdDecompress(zstdCompressedAsync);
```
