import { defineConfig } from "ts-unused";

// registry-cli consumes this package through its entrypoint, so treat the public API as used.
export default defineConfig({
  packageMode: true,
});
