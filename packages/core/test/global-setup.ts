import { spawnSync } from "node:child_process";
import path from "node:path";

// Drops and re-creates the test schema before any test file runs.
export default function setup() {
  const dbDir = path.resolve(__dirname, "../../database");
  const r = spawnSync("node", ["scripts/prisma.mjs", "migrate", "reset", "--force", "--skip-seed", "--skip-generate"], {
    cwd: dbDir,
    stdio: "inherit",
    env: { ...process.env, DATABASE_SCHEMA: "test_core" },
  });
  if (r.status !== 0) throw new Error("migrate reset failed for test_core");
}
