// Runs the Prisma CLI against one environment's Postgres schema.
//
//   DATABASE_SCHEMA=dev node --env-file=../../.env.local scripts/prisma.mjs migrate deploy
//
// Migrations and seeds use the unpooled URL (the pooler cannot run DDL safely).
// DATABASE_SCHEMA=public is production — the script refuses it unless
// ALLOW_PRODUCTION=1 is set, so a typo never migrates the live database.
import { spawnSync } from "node:child_process";

const schema = process.env.DATABASE_SCHEMA || "public";
if (schema === "public" && process.env.ALLOW_PRODUCTION !== "1") {
  console.error("Refusing to run against the production schema (public). Set ALLOW_PRODUCTION=1 to confirm.");
  process.exit(1);
}
if (!/^[a-z][a-z0-9_]*$/.test(schema)) {
  console.error(`Invalid DATABASE_SCHEMA "${schema}"`);
  process.exit(1);
}
const base = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!base) {
  console.error("DATABASE_URL_UNPOOLED / DATABASE_URL is not set");
  process.exit(1);
}
const url = new URL(base);
if (schema !== "public") url.searchParams.set("schema", schema);

console.error(`[prisma] schema=${schema} → prisma ${process.argv.slice(2).join(" ")}`);
const r = spawnSync("npx", ["prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url.toString(), DATABASE_SCHEMA: schema },
});
process.exit(r.status ?? 1);
