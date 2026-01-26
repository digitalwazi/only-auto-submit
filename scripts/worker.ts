
import { processBatch } from "../src/lib/worker";
import prisma from "../src/lib/prisma";
import { logToDB } from "../src/lib/logs";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

const POLL_INTERVAL = 5000; // 5 seconds
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes max for a job

async function cleanupStuckJobs() {
    try {
        // await logToDB("Checking for stuck jobs...", "INFO"); // Too noisy
        // console.log("[INFO] Checking for stuck jobs...");

        const stuckLinks = await prisma.link.findMany({
            where: { status: "PROCESSING" },
            select: { id: true, url: true }
        });

        if (stuckLinks.length === 0) return;

        // Try to find if one of these caused a crash
        const lastLog = await prisma.systemLog.findFirst({
            where: { message: { startsWith: "Processing:" } },
            orderBy: { id: "desc" }
        });

        let crashCulpritId = null;
        if (lastLog) {
            const lastUrl = lastLog.message.replace("Processing: ", "").trim();
            const culprit = stuckLinks.find(l => l.url === lastUrl);
            // Verify the log is recent (within 20 mins) to avoid false positives from old logs
            const logTime = new Date(lastLog.createdAt).getTime();
            if (culprit && (Date.now() - logTime < 20 * 60 * 1000)) {
                crashCulpritId = culprit.id;
            }
        }

        // 1. Reset innocent links
        const innocentIds = stuckLinks.filter(l => l.id !== crashCulpritId).map(l => l.id);
        if (innocentIds.length > 0) {
            await prisma.link.updateMany({
                where: { id: { in: innocentIds } },
                data: { status: "PENDING", error: "Recovered from crash (Safe Retry)" }
            });
            await logToDB(`Recovered ${innocentIds.length} stuck jobs (reset to PENDING).`, "WARN");
            console.log(`🔄 Recovered ${innocentIds.length} stuck jobs.`);
        }

        // 2. Fail the culprit
        if (crashCulpritId) {
            const culprit = stuckLinks.find(l => l.id === crashCulpritId);
            await prisma.link.update({
                where: { id: crashCulpritId },
                data: { status: "FAILED", error: "CRASH DETECTED: Worker died while processing this link." }
            });
            await logToDB(`MARKED FAILED: ${culprit?.url} (Caused Worker Crash)`, "ERROR");
            console.log(`❌ BLOCKING CRASH CULPRIT: ${culprit?.url}`);
        }

    } catch (e) {
        console.error("Cleanup Error:", e);
    }
}

async function runWorker() {
    console.log("🚀 Background Worker Started");
    await logToDB("Background Worker Daemon started.", "INFO");

    // Cleanup zombies (chrome) first
    try {
        console.log("🧹 Killing zombie chrome processes...");
        await execAsync("pkill -f chrome || true");
        await execAsync("pkill -f chromium || true");
    } catch (e) { console.error("Zombie kill failed", e); }

    // Cleanup on start
    await cleanupStuckJobs();

    // Independent Watchdog (Runs every 2 minutes)
    setInterval(async () => {
        try {
            console.log("⏰ Running Watchdog Check...");
            await cleanupStuckJobs();

            // LIVENESS CHECK: If no new logs in DB for 5 minutes (reduced), assume HUNG.
            const lastLog = await prisma.systemLog.findFirst({ orderBy: { id: "desc" } });
            if (lastLog) {
                const timeDiff = Date.now() - new Date(lastLog.createdAt).getTime();

                if (timeDiff > 5 * 60 * 1000) { // 5 minutes silence
                    console.error(`💀 WORKER HUNG (${Math.round(timeDiff / 1000)}s silence). Committing suicide...`);
                    await logToDB(`Worker HUNG detected (${Math.round(timeDiff / 1000)}s silence). Forcing restart...`, "ERROR");
                    process.exit(1);
                }
            }

            // MEMORY LEAK CHECK (Soft Restart)
            const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
            // console.log(`Memory Usage: ${Math.round(memoryUsage)} MB`);
            if (memoryUsage > 500) { // 500 MB Limit
                console.log(`⚠️ Memory usage high (${Math.round(memoryUsage)}MB). Performing preventive restart...`);
                await logToDB(`Preventive Restart: Memory usage high (${Math.round(memoryUsage)}MB).`, "WARN");
                process.exit(0);
            }

            // Also write heartbeat here to be sure
            const time = new Date().toISOString();
            const logMsg = `[${time}] Watchdog ALIVE\n`;
            const logDir = "./logs";
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            fs.appendFileSync(`${logDir}/worker.log`, logMsg);

        } catch (e) { console.error("Watchdog Failed", e); }
    }, 2 * 60 * 1000);

    const IDLE_TIMEOUT = 30000; // 30s
    let lastProcessedTime = Date.now();
    let isProcessing = false; // Track if we are busy

    // Independent Watchdog Interval (30s)
    setInterval(async () => {
        try {
            if (isProcessing) {
                // If processing for > 3 minutes, assume hung
                if (Date.now() - lastProcessedTime > 3 * 60 * 1000) {
                    console.error("💀 WORKER HUNG in processBatch. forcing exit...");
                    await logToDB("Worker HUNG in processBatch (>3m). Forcing restart...", "ERROR");
                    process.exit(1);
                }
                return;
            }

            // Only run this check if we seem IDLE
            if (Date.now() - lastProcessedTime > IDLE_TIMEOUT) {
                // 1. Check if we have PENDING links globally
                const pendingCount = await prisma.link.count({ where: { status: "PENDING" } });
                if (pendingCount === 0) return;

                console.log(`[Watchdog] Global Pending Links found (${pendingCount}) but Worker is IDLE.`);

                const firstPendingLink = await prisma.link.findFirst({
                    where: { status: "PENDING" },
                    select: { campaignId: true }
                });

                if (firstPendingLink) {
                    const campaignId = firstPendingLink.campaignId;

                    // Force status to RUNNING
                    await prisma.campaign.update({
                        where: { id: campaignId },
                        data: { status: "RUNNING" }
                    });
                    await logToDB(`Watchdog: Auto-Resumed campaign ${campaignId}`, "WARN");

                    lastProcessedTime = Date.now(); // Reset timer
                }
            }
        } catch (e) {
            console.error("Watchdog Interval Error:", e);
        }
    }, 30000);

    while (true) {
        try {
            isProcessing = true;

            // Race processBatch against a 4-minute timeout
            const result = await Promise.race([
                processBatch(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("BATCH_TIMEOUT")), 240000))
            ]) as any;

            isProcessing = false;

            if (result.processed > 0) {
                lastProcessedTime = Date.now();
            }

            if (result.status === "IDLE") {
                // Main loop is idle, just wait
            } else if (result.status === "WORKER_OFF") {
                console.log("Worker is OFF in settings.");
            }

        } catch (error: any) {
            isProcessing = false;
            console.error("Worker Error:", error);
            await logToDB(`Worker Daemon Error: ${error.message || "Unknown"}`, "ERROR");

            // If it was a timeout, critical failure
            if (error.message === "BATCH_TIMEOUT") {
                process.exit(1);
            }
        }

        try {
            const time = new Date().toISOString();
            const logMsg = `[${time}] Worker ALIVE - Loop OK\n`;
            const logDir = "./logs";
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            fs.appendFileSync(`${logDir}/worker.log`, logMsg);
        } catch (e) { }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
}

// Start the worker
runWorker().catch(e => {
    console.error("Fatal Worker Error:", e);
    process.exit(1);
});
