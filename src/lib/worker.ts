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
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ========== SERVER CRASH PREVENTION SAFEGUARDS ==========
const LOCK_FILE = "/tmp/auto-submitter-worker.lock";
const MIN_FREE_MEMORY_MB = 1024; // 1GB minimum free RAM required
const COOLDOWN_SECONDS = 30; // Wait between batches
const MAX_CHROME_PROCESSES = 2; // If more than this, skip processing

let lastProcessTime = 0;

function acquireLock(): boolean {
    try {
        // Check if lock exists and is stale (older than 5 minutes)
        if (fs.existsSync(LOCK_FILE)) {
            const stats = fs.statSync(LOCK_FILE);
            const ageMs = Date.now() - stats.mtimeMs;
            if (ageMs > 5 * 60 * 1000) {
                console.log("[Worker] Removing stale lock file");
                fs.unlinkSync(LOCK_FILE);
            } else {
                console.log("[Worker] Lock file exists, another worker is running");
                return false;
            }
        }
        fs.writeFileSync(LOCK_FILE, String(process.pid));
        return true;
    } catch (e) {
        console.error("[Worker] Lock acquisition failed:", e);
        return false;
    }
}

function releaseLock(): void {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
        }
    } catch (e) {
        console.error("[Worker] Lock release failed:", e);
    }
}

function countChromeProcesses(): number {
    try {
        if (process.platform === "linux") {
            const result = execSync("pgrep -c chrome 2>/dev/null || echo 0", { encoding: "utf8" });
            return parseInt(result.trim(), 10) || 0;
        }
        return 0; // Skip check on non-Linux
    } catch {
        return 0;
    }
}

function killZombieChromes(): void {
    try {
        if (process.platform === "linux") {
            execSync("pkill -9 -f 'chrome.*puppeteer' 2>/dev/null || true");
            execSync("rm -rf /tmp/puppeteer* 2>/dev/null || true");
            console.log("[Worker] Cleaned up zombie Chrome processes");
        }
    } catch (e) {
        // Ignore errors
    }
}

function checkMemory(): { ok: boolean; freeMB: number } {
    const freeMem = os.freemem();
    const freeMB = Math.floor(freeMem / 1024 / 1024);
    return { ok: freeMB >= MIN_FREE_MEMORY_MB, freeMB };
}

function checkCooldown(): boolean {
    const now = Date.now();
    const elapsed = (now - lastProcessTime) / 1000;
    if (lastProcessTime > 0 && elapsed < COOLDOWN_SECONDS) {
        console.log(`[Worker] Cooldown: ${Math.ceil(COOLDOWN_SECONDS - elapsed)}s remaining`);
        return false;
    }
    return true;
}
// ========== END SAFEGUARDS ==========

export async function processBatch() {
    // === SAFEGUARD 1: Memory Check (1GB minimum) ===
    const memCheck = checkMemory();
    if (!memCheck.ok) {
        console.warn(`[Worker] LOW MEMORY: ${memCheck.freeMB}MB free. Required: ${MIN_FREE_MEMORY_MB}MB. Skipping.`);
        return { processed: 0, status: "LOW_MEMORY" };
    }

    // === SAFEGUARD 2: Cooldown Between Batches ===
    if (!checkCooldown()) {
        return { processed: 0, status: "COOLDOWN" };
    }

    // === SAFEGUARD 3: Process Lock (prevent concurrent workers) ===
    if (!acquireLock()) {
        return { processed: 0, status: "LOCKED" };
    }

    // === SAFEGUARD 4: Chrome Process Limit ===
    const chromeCount = countChromeProcesses();
    if (chromeCount > MAX_CHROME_PROCESSES) {
        console.warn(`[Worker] Too many Chrome processes: ${chromeCount}. Cleaning up...`);
        killZombieChromes();
        releaseLock();
        return { processed: 0, status: "CHROME_OVERLOAD" };
    }

    try {
        // Update last process time
        lastProcessTime = Date.now();

        // Instantiate Engine per batch for isolation
        const browserManager = new BrowserManager();
        const pageScanner = new PageScanner();
        const formEngine = new FormEngine();
        const submitter = new SubmissionStrategies();
        const verifier = new Verifier();

        const settings = await getSettings();
        if (!settings.isWorkerOn) {
            releaseLock();
            return { processed: 0, status: "WORKER_OFF" };
        }

        // ========== STUCK LINK RECOVERY (30 SECOND TIMEOUT) ==========
        try {
            const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

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

        // Stability: Process 1 link at a time
        const concurrency = 1;

        // 1. Get Campaign
        const campaign = await prisma.campaign.findFirst({
            where: { status: "RUNNING" },
            select: { id: true, name: true, fields: true, status: true, headless: true }
        });

        if (!campaign) {
            releaseLock();
            return { processed: 0, status: "IDLE" };
        }

        console.log(`[Worker] Found Campaign: ${campaign.name} (${campaign.id})`);

        let fields: CampaignField[];
        try {
            fields = JSON.parse(campaign.fields) as CampaignField[];
        } catch (e) {
            console.error(`[Worker] Failed to parse fields`, e);
            releaseLock();
            return { processed: 0, status: "FAILED_FIELDS" };
        }

        // 2. Get Links
        const links = await prisma.link.findMany({
            where: { campaignId: campaign.id, status: "PENDING" },
            take: concurrency,
        });

        if (links.length === 0) {
            const remaining = await prisma.link.count({ where: { campaignId: campaign.id, status: "PENDING" } });
            if (remaining === 0) {
                await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "COMPLETED" } });
                await logToDB(`Campaign "${campaign.name}" completed!`, "SUCCESS");
            }
            releaseLock();
            return { processed: 0, status: "COMPLETED_CAMPAIGN" };
        }

        // 3. Launch Browser via Manager
        console.log(`[Worker] Starting Batch of ${links.length}...`);
        let browser;
        try {
            browser = await browserManager.launch(campaign.headless !== false);
        } catch (e) {
            console.error("[Worker] Failed to launch browser:", e);
            killZombieChromes(); // Clean up on failure
            releaseLock();
            return { processed: 0, status: "BROWSER_FAIL" };
        }

        // 4. Process Loop
        for (const link of links) {
            let page = null;
            try {
                await prisma.link.update({ where: { id: link.id }, data: { status: "PROCESSING", error: null } });
                await logToDB(`Processing: ${link.url}`, "INFO");

                page = await browserManager.newPage(browser);

                try {
                    await page.goto(link.url, { waitUntil: "domcontentloaded", timeout: 15000 });
                } catch (e) {
                    throw new Error("TIMEOUT: Site unreachable or too slow");
                }

                const features = await pageScanner.scan(page);
                if (features.hasCaptcha) throw new Error("SKIP_CAPTCHA");

                await pageScanner.handleOverlays(page);

                const filled = await formEngine.fillForm(page, fields);
                if (!filled) throw new Error("SKIP_NO_FIELDS");

                const beforeUrl = page.url();
                const beforeContent = await page.content();

                await submitter.execute(page, beforeUrl, beforeContent);

                const result = await verifier.verify(page, beforeUrl, beforeContent, link.id);

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
                    status = "SKIPPED";
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

            } finally {
                if (page) try { await page.close(); } catch (e) { }
            }
        }

        // Always close browser after batch
        await browserManager.close();
        releaseLock();

        return { processed: links.length, status: "OK" };

    } catch (error) {
        console.error("[Worker] Unexpected error:", error);
        killZombieChromes();
        releaseLock();
        return { processed: 0, status: "ERROR" };
    }
}
