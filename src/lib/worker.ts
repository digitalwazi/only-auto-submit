
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createCursor } from "ghost-cursor";
import prisma from "./prisma";
import { getSettings } from "./settings";
import { logToDB } from "./logs";

// 1. Enable Stealth Plugin
puppeteer.use(StealthPlugin());

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0"
];

export async function processCampaign(campaignId: string) {
    const settings = await getSettings();
    if (!settings.isWorkerOn) return;

    const concurrency = settings.concurrency || 2; // Reduced for VPS stability
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, name: true, fields: true, status: true, headless: true }
    });

    if (!campaign || campaign.status !== "RUNNING") return;

    // Per-campaign Headless Override
    const isHeadless = campaign.headless !== false;

    const fields = JSON.parse(campaign.fields);
    const links = await prisma.link.findMany({
        where: { campaignId, status: "PENDING" },
        take: concurrency,
    });

    if (links.length === 0) {
        const remaining = await prisma.link.count({
            where: { campaignId, status: "PENDING" }
        });
        if (remaining === 0) {
            await prisma.campaign.update({
                where: { id: campaignId },
                data: { status: "COMPLETED" }
            });
            await logToDB(`Campaign "${campaign.name}" completed!`, "SUCCESS");
        }
        return;
    }

    // Launch Browser
    const browser = await puppeteer.launch({
        headless: isHeadless,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080',
            '--disable-dev-shm-usage'
        ],
        defaultViewport: null
    });

    try {
        await Promise.all(links.map(async (link) => {
            let page;
            try {
                await prisma.link.update({ where: { id: link.id }, data: { status: "PROCESSING", error: null } });
                await logToDB(`Processing: ${link.url}`, "INFO");

                page = await browser.newPage();

                // Randomize User Agent
                const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
                await page.setUserAgent(randomUA);

                // Initialize Ghost Cursor
                const cursor = createCursor(page);

                try {
                    await page.goto(link.url, { waitUntil: "networkidle2", timeout: 45000 });
                } catch (e) {
                    throw new Error(`Load Timeout or Error: ${e instanceof Error ? e.message : "Unknown"}`);
                }

                // NO CAPTCHA SOLVER HERE - REMOVED AS REQUESTED

                let fieldFound = false;
                for (const field of fields) {
                    const searchTerms = [field.name, field.label];
                    if (field.name.toLowerCase().includes("name")) searchTerms.push("author", "firstname", "first_name", "last_name", "user");
                    if (field.name.toLowerCase().includes("message")) searchTerms.push("comment", "description", "body", "details");
                    if (field.name.toLowerCase().includes("email")) searchTerms.push("mail", "e-mail");

                    const selectors = searchTerms.flatMap(term => [
                        `input[name*="${term}" i]`,
                        `input[id*="${term}" i]`,
                        `input[placeholder*="${term}" i]`,
                        `textarea[name*="${term}" i]`,
                        `textarea[id*="${term}" i]`,
                        `textarea[placeholder*="${term}" i]`
                    ]).join(", ");

                    try {
                        const element = await page.waitForSelector(selectors, { timeout: 3000 });
                        if (element) {
                            await cursor.move(element);
                            try {
                                await element.click({ clickCount: 3 });
                                await element.press('Backspace');
                            } catch (e) { }

                            // Optimized Human-like typing (Faster)
                            await element.type(field.value, { delay: Math.floor(Math.random() * 10) + 5 });
                            fieldFound = true;
                        }
                    } catch (e) { }
                }

                if (!fieldFound) {
                    throw new Error("No matching form fields found");
                }

                // Submit Logic
                let submitted = false;
                const textTargets = ["Submit", "Send", "Post", "Contact", "Message", "Go", "Comment"];

                for (const text of textTargets) {
                    if (submitted) break;
                    try {
                        const xpath = `//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')] | //input[@type='submit' and contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;
                        const elements = await page.$$(`xpath/${xpath}`);
                        for (const element of elements) {
                            try {
                                if (await element.boundingBox()) {
                                    await cursor.click(element);
                                    submitted = true;
                                    await new Promise(r => setTimeout(r, 1000)); // Reduced wait
                                    break;
                                }
                            } catch (e) { }
                        }
                    } catch (e) { }
                }

                if (!submitted) {
                    const submitSelectors = [
                        'button[type="submit"]',
                        'input[type="submit"]',
                        'button[class*="submit" i]',
                        'button[class*="send" i]',
                        'button[class*="btn-primary" i]',
                        'button:not([type="button"]):not([type="reset"])',
                    ];

                    for (const selector of submitSelectors) {
                        try {
                            const btn = await page.$(selector);
                            if (btn && await btn.boundingBox()) {
                                await cursor.click(btn);
                                submitted = true;
                                await new Promise(r => setTimeout(r, 2000));
                                break;
                            }
                        } catch (e) { }
                    }
                }

                // Fallback JS Submit
                if (!submitted) {
                    submitted = await page.evaluate(() => {
                        const form = document.querySelector('form');
                        if (form) {
                            form.requestSubmit ? form.requestSubmit() : form.submit();
                            return true;
                        }
                        return false;
                    });
                    await new Promise(r => setTimeout(r, 2000));
                }

                // --- VALIDATION AND ERROR HANDLING ---
                try {
                    const pageContent = (await page.content()).toLowerCase();

                    if (pageContent.includes("duplicate comment") || pageContent.includes("already said that")) {
                        throw new Error("FAIL_DUPLICATE: Duplicate submission detected");
                    }
                    if (pageContent.includes("captcha") || pageContent.includes("prove you are human")) {
                        throw new Error("FAIL_CAPTCHA: Blocked by CAPTCHA");
                    }

                    await prisma.link.update({ where: { id: link.id }, data: { status: "SUCCESS", error: null } });
                    await logToDB(`SUCCESS: ${link.url}`, "SUCCESS");

                } catch (error: any) {
                    // CRITICAL FIX: Handle "Execution context was destroyed"
                    const emsg = error.message || "";
                    if (emsg.includes("Execution context was destroyed") || emsg.includes("Protocol error") || emsg.includes("Target closed")) {
                        await prisma.link.update({ where: { id: link.id }, data: { status: "SUCCESS", error: null } });
                        await logToDB(`SUCCESS (Redirected): ${link.url}`, "SUCCESS");
                    } else {
                        throw error;
                    }
                }

            } catch (error: any) {
                await logToDB(`FAILED: ${link.url} - ${error.message || "Unknown error"}`, "ERROR");
                await prisma.link.update({
                    where: { id: link.id },
                    data: { status: "FAILED", error: error.message || "Unknown error" }
                });
            } finally {
                if (page) try { await page.close(); } catch (e) { } // Safe close
            }
        }));
    } finally {
        try { await browser.close(); } catch (e) { } // Safe close
    }

    // Auto-Restart Logic
    if (settings.autoRestartInterval > 0) {
        const uptimeMinutes = process.uptime() / 60;
        if (uptimeMinutes > settings.autoRestartInterval) {
            await logToDB(`Auto-restart triggered after ${Math.round(uptimeMinutes)} minutes.`, "WARN");
            process.exit(0);
        }
    }
}
