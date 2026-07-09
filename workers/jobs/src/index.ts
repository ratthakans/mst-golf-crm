import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import { runNightlyAnalytics, type NightlySummary } from "./nightly";

const QUEUE = "analytics";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Pass connection options (not an instance) so BullMQ manages its own ioredis
// client — avoids version clashes and sets maxRetriesPerRequest itself.
const url = new URL(REDIS_URL);
const connection: ConnectionOptions = {
  host: url.hostname,
  port: Number(url.port || 6379),
  password: url.password || undefined,
};

export const analyticsQueue = new Queue(QUEUE, { connection });

/** Register the nightly (02:00) repeatable job for an org. */
export async function scheduleNightly(orgSlug = "mst-golf"): Promise<void> {
  await analyticsQueue.add(
    "nightly-analytics",
    { orgSlug },
    { repeat: { pattern: "0 2 * * *" }, jobId: `nightly-${orgSlug}` },
  );
  console.log(`[jobs] scheduled nightly-analytics for ${orgSlug} (02:00 daily)`);
}

export function startWorker(): Worker {
  const worker = new Worker(
    QUEUE,
    async (job: Job): Promise<NightlySummary> => {
      console.log(`[jobs] running ${job.name} …`);
      return runNightlyAnalytics(job.data.orgSlug ?? "mst-golf");
    },
    { connection },
  );
  worker.on("completed", (job, result: NightlySummary) => {
    console.log(`[jobs] ${job.name} done:`, JSON.stringify(result));
  });
  worker.on("failed", (job, err) => {
    console.error(`[jobs] ${job?.name} failed:`, err.message);
  });
  return worker;
}

// `pnpm --filter @mstgolf/jobs dev` — start the worker and register the schedule.
if (require.main === module) {
  startWorker();
  scheduleNightly().catch((e) => {
    console.error("[jobs] failed to schedule:", e);
    process.exit(1);
  });
  console.log("[jobs] worker running. Ctrl-C to exit.");
}
