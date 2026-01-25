
import { processCampaign } from "../src/lib/worker";
import prisma from "../src/lib/prisma";
import { logToDB } from "../src/lib/logs";
import fs from "fs";

const POLL_INTERVAL = 5000; // 5 seconds
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes max for a job

async function cleanupStuckJobs() {
    try {
        await logToDB("Checking for stuck jobs...", "INFO");
        // Reset any jobs that are 'PROCESSING' on startup (assumes single worker instance)
        const { count } = await prisma.link.updateMany({
            where: { status: "PROCESSING" },
            data: { status: "PENDING", error: "Recovered from crash" }
        });
        if (count > 0) {
            await logToDB(`Recovered ${count} stuck jobs (reset to PENDING).`, "WARN");
            console.log(`🔄 Recovered ${count} stuck jobs.`);
        }
    } catch (e) {
        console.error("Cleanup Error:", e);
    }
}

async function runWorker() {
    console.log("🚀 Background Worker Started");
    await logToDB("Background Worker Daemon started.", "INFO");

    // Cleanup on start
    await cleanupStuckJobs();

    while (true) {
        try {
            // Find running campaigns
            const campaigns = await prisma.campaign.findMany({
                where: { status: "RUNNING" },
                select: { id: true, name: true }
            });

            if (campaigns.length > 0) {
                // console.log(`found ${campaigns.length} active campaigns.`);
                for (const campaign of campaigns) {
                    await processCampaign(campaign.id);
                }
            }
        } catch (error) {
            console.error("Worker Error:", error);
            await logToDB(`Worker Daemon Error: ${error instanceof Error ? error.message : "Unknown"}`, "ERROR");
        }


        // Heartbeat Logger (Proof of Life)
        try {
            const time = new Date().toISOString();
            const logMsg = `[${time}] Worker ALIVE - Campaigns found: Unknown(Loop)\n`;

            const logDir = "./logs";
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            fs.appendFileSync(`${logDir}/worker.log`, logMsg);
            // console.log("HEARTBEAT WRITTEN to logs/worker.log");
        } catch (e) { console.error("Logger failed", e); }

        // Periodic Cleanup (Every 5 minutes approx)
        if (Date.now() % 300000 < POLL_INTERVAL * 2) {
            console.log("⏰ Running Periodic Watchdog...");
            await cleanupStuckJobs();
        }

        // Wait before next loop
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
}

// Start the worker
runWorker().catch(e => {
    console.error("Fatal Worker Error:", e);
    process.exit(1);
});
