import { PrismaClient } from "../../../generated/prisma";
import { publishScheduledPost } from "@smartreach/publish";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const prisma = new PrismaClient();
const pollMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 15000);

let running = false;

async function sweep() {
  if (running) return;
  running = true;
  try {
    const due = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        publishAt: { lte: new Date() },
      },
      take: 25,
    });
    for (const s of due) {
      const ok = await publishScheduledPost(prisma, s.id);
      console.log(
        `[worker] ${ok ? "published" : "FAILED"} ${s.platform} -> post ${s.postId}`,
      );
    }
    if (due.length > 0) {
      console.log(`[worker] sweep complete (${due.length} due posts)`);
    }
  } catch (err) {
    console.error("[worker] sweep error:", (err as Error).message);
  } finally {
    running = false;
  }
}

console.log(`[worker] publishing worker started — polling every ${pollMs}ms`);
sweep();
setInterval(sweep, pollMs);

async function shutdown() {
  console.log("[worker] shutting down");
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
