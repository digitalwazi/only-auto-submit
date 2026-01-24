
import { processCampaign } from "../src/lib/worker";
import prisma from "../src/lib/prisma";
import { logToDB } from "../src/lib/logs";

const POLL_INTERVAL = 5000; // 5 seconds

async function runWorker() {
    console.log("🚀 Background Worker Started");
    await logToDB("Background Worker Daemon started.", "INFO");

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

        // Wait before next loop
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
}

// Start the worker
runWorker().catch(e => {
    console.error("Fatal Worker Error:", e);
    process.exit(1);
});
