import { defineConfig } from "vitest/config";

// Integration tests against a real Postgres schema ("test_core" in the shared
// Neon database — never public). Run: pnpm --filter @mstgolf/core test:db
export default defineConfig({
  test: {
    include: ["test/**/*.db.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    env: { DATABASE_SCHEMA: "test_core" },
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
