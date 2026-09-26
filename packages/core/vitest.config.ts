import { defineConfig } from "vitest/config";

// Pure unit tests only (no database).
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
