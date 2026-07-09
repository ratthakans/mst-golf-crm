import { runNightlyAnalytics } from "./nightly";

// One-off runner: `pnpm --filter @mstgolf/jobs run:nightly`
// Computes snapshots + automation audiences immediately (no Redis needed).
runNightlyAnalytics(process.argv[2] ?? "mst-golf")
  .then((summary) => {
    console.log("Nightly analytics complete:", JSON.stringify(summary, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error("Nightly analytics failed:", e);
    process.exit(1);
  });
