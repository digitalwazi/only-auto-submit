
import prisma from "./prisma";
import { getSettings } from "./settings";
import { logToDB } from "./logs";
import { BrowserManager } from "./engine/BrowserManager";
import { PageScanner } from "./engine/PageScanner";
import { FormEngine } from "./engine/FormEngine";
import { SubmissionStrategies } from "./engine/SubmissionStrategies";
import { Verifier } from "./engine/Verifier";
import { CampaignField } from "./engine/types";

import os from "os";

// Engine Classes (Lazy Instantiation)
// const browserManager = new BrowserManager(); // Moved inside
// const pageScanner = new PageScanner();
// const formEngine = new FormEngine();
// const submitter = new SubmissionStrategies();
// const verifier = new Verifier();

export async function processBatch() {
    // MEMORY SAFEGUARD for VPS
    try {
        const freeMem = os.freemem();
        const minMem = 500 * 1024 * 1024; // 500MB
        if (freeMem < minMem) {
            console.warn(`[Worker] LOW MEMORY: ${(freeMem / 1024 / 1024).toFixed(0)}MB free. Threshold: 500MB. Skipping batch.`);
            return { processed: 0, status: "LOW_MEMORY" };
        }
    } catch (e) {
        console.error("[Worker] Memory check failed", e);
    }

    // Instantiate Engine per batch for isolation
    const browserManager = new BrowserManager();
    const pageScanner = new PageScanner();
    const formEngine = new FormEngine();
    const submitter = new SubmissionStrategies();
    const verifier = new Verifier();

    const settings = await getSettings();
    if (!settings.isWorkerOn) return { processed: 0, status: "WORKER_OFF" };

    // ========== STUCK LINK RECOVERY (30 SECOND TIMEOUT) ==========
    try {
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

        // Reset any links stuck in PROCESSING for more than 30 seconds
        const stuckLinks = await prisma.link.updateMany({
            where: {
                status: "PROCESSING",
                updatedAt: { lt: thirtySecondsAgo }
            },
            data: { status: "PENDING", error: "Auto-recovered from stuck PROCESSING state" }
        });

        if (stuckLinks.count > 0) {
            console.log(`[Worker] Recovered ${stuckLinks.count} stuck links`);
            await logToDB(`Auto-recovered ${stuckLinks.count} stuck links`, "WARN");
        }

        // Reactivate COMPLETED campaigns that have pending links (race condition fix)
        const completedCampaigns = await prisma.campaign.findMany({
            where: { status: "COMPLETED" },
            select: { id: true, name: true }
        });

        for (const camp of completedCampaigns) {
            const pendingCount = await prisma.link.count({
                where: { campaignId: camp.id, status: "PENDING" }
            });
            if (pendingCount > 0) {
                await prisma.campaign.update({
                    where: { id: camp.id },
                    data: { status: "RUNNING" }
                });
                console.log(`[Worker] Reactivated campaign "${camp.name}" with ${pendingCount} pending links`);
                await logToDB(`Reactivated campaign "${camp.name}"`, "INFO");
            }
        }
    } catch (e) {
        console.error("[Worker] Recovery check failed:", e);
    }
    // ========== END STUCK LINK RECOVERY ==========

    // Stability: Process 1 link at a time
    const concurrency = 1;

    // 1. Get Campaign
    const campaign = await prisma.campaign.findFirst({
        where: { status: "RUNNING" },
        select: { id: true, name: true, fields: true, status: true, headless: true }
    });

    if (!campaign) return { processed: 0, status: "IDLE" };

    console.log(`[Worker] Found Campaign: ${campaign.name} (${campaign.id})`);

    let fields: CampaignField[];
    try {
        fields = JSON.parse(campaign.fields) as CampaignField[];
    } catch (e) {
        console.error(`[Worker] Failed to parse fields`, e);
        return { processed: 0, status: "FAILED_FIELDS" };
    }

    // 2. Get Links
    const links = await prisma.link.findMany({
        where: { campaignId: campaign.id, status: "PENDING" },
        take: concurrency,
    });

    if (links.length === 0) {
        // Completion Check
        const remaining = await prisma.link.count({ where: { campaignId: campaign.id, status: "PENDING" } });
        if (remaining === 0) {
            await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "COMPLETED" } });
            await logToDB(`Campaign "${campaign.name}" completed!`, "SUCCESS");
        }
        return { processed: 0, status: "COMPLETED_CAMPAIGN" };
    }

    // 3. Launch Browser via Manager
    console.log(`[Worker] Starting Batch of ${links.length}...`);
    let browser;
    try {
        browser = await browserManager.launch(campaign.headless !== false);
    } catch (e) {
        console.error("Failed to launch browser", e);
        return { processed: 0, status: "BROWSER_FAIL" };
    }

    // 4. Process Loop
    for (const link of links) {
        let page = null;
        try {
            // Update Status
            await prisma.link.update({ where: { id: link.id }, data: { status: "PROCESSING", error: null } });
            await logToDB(`Processing: ${link.url}`, "INFO");

            // New Page
            page = await browserManager.newPage(browser);

            // Navigate
            try {
                await page.goto(link.url, { waitUntil: "domcontentloaded", timeout: 15000 });
            } catch (e) {
                throw new Error("TIMEOUT: Site unreachable or too slow");
            }

            // Scan (Fail Fast)
            const features = await pageScanner.scan(page);
            if (features.hasCaptcha) throw new Error("SKIP_CAPTCHA");

            // Handle Obstructions
            await pageScanner.handleOverlays(page);

            // Fill Form
            const filled = await formEngine.fillForm(page, fields);
            if (!filled) throw new Error("SKIP_NO_FIELDS");

            // Capture state before submit
            const beforeUrl = page.url();
            const beforeContent = await page.content();

            // Submit
            await submitter.execute(page, beforeUrl, beforeContent);

            // Verify
            const result = await verifier.verify(page, beforeUrl, beforeContent, link.id);

            // Save Result
            await prisma.link.update({
                where: { id: link.id },
                data: {
                    status: result.status,
                    error: result.status === 'SUCCESS' ? null : result.reason,
                    submittedUrl: result.submittedUrl,
                    screenshotPath: result.screenshotPath
                }
            });

            await logToDB(
                `${result.status}: ${link.url} [${result.reason}]`,
                result.status === 'SUCCESS' ? "SUCCESS" : (result.status === 'WARN' ? "WARN" : "ERROR")
            );

        } catch (error: any) {
            const msg = error.message || "Unknown Error";
            let status = "FAILED";
            let logLevel: "ERROR" | "WARN" = "ERROR";

            if (msg.includes("SKIP_CAPTCHA") || msg.includes("SKIP_NO_FIELDS")) {
                status = "SKIPPED"; // Or FAILED with specific message
                logLevel = "WARN";
            } else if (msg.includes("TIMEOUT")) {
                status = "FAILED";
                logLevel = "WARN";
            }

            await logToDB(`${status}: ${link.url} - ${msg}`, logLevel);
            await prisma.link.update({
                where: { id: link.id },
                data: { status: status, error: msg }
            });

            // Capture failure screenshot if page exists and wasn't closed
            if (page && !page.isClosed()) {
                await verifier.verify(page, "", "", link.id); // Re-use verifier just to snap screenshot if needed, but verifier logic is bound to result...
                // Actually, verifier logic captures screenshot inside. 
                // We should probably explicitly capture here if the error wasn't from verifier.
                // But let's rely on the previous logic: if it crashed, we might not get a screenshot, 
                // but if it failed verification, we already have one.
            }
        } finally {
            if (page) try { await page.close(); } catch (e) { }
        }
    }

    // Clean up browser (Since we process 1 per batch, we verify stability by closing)
    await browserManager.close();

    return { processed: links.length, status: "OK" };
}
