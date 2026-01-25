import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha";
import { createCursor } from "ghost-cursor";
import prisma from "./prisma";
import { getSettings } from "./settings";
import { logToDB } from "./logs";
import fs from "fs";

// 1. Enable Stealth & Recaptcha Plugins
puppeteer.use(StealthPlugin());
puppeteer.use(
    RecaptchaPlugin({
        provider: { id: "2captcha", token: "DISABLED" },
        visualFeedback: true,
    })
);

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0"
];

export async function processBatch() {
    const settings = await getSettings();
    if (!settings.isWorkerOn) return { processed: 0, status: "WORKER_OFF" };

    const concurrency = 10; // Process 10 links per worker run (Batch Size)

    // Find a RUNNING campaign
    const campaign = await prisma.campaign.findFirst({
        where: { status: "RUNNING" },
        select: { id: true, name: true, fields: true, status: true, headless: true }
    });

    if (!campaign) return { processed: 0, status: "IDLE" };

    // Per-campaign Headless Override
    const isHeadless = campaign.headless !== false;
    const fields = JSON.parse(campaign.fields);

    // Get a batch of PENDING links
    const links = await prisma.link.findMany({
        where: { campaignId: campaign.id, status: "PENDING" },
        take: concurrency,
    });

    if (links.length === 0) {
        // Check if finished
        const remaining = await prisma.link.count({
            where: { campaignId: campaign.id, status: "PENDING" }
        });
        if (remaining === 0) {
            await prisma.campaign.update({
                where: { id: campaign.id },
                data: { status: "COMPLETED" }
            });
            await logToDB(`Campaign "${campaign.name}" completed!`, "SUCCESS");
        }
        return { processed: 0, status: "COMPLETED_CAMPAIGN" };
    }

    // --- FRESH BROWSER PER JOB ARCHITECTURE ---
    // Instead of one browser for all links, we launch one per link (or small batch).
    // This is slower but 1000x more stable as it guarantees memory reclamation.

    // --- OPTIMIZED BATCH ARCHITECTURE ---
    // Launch one browser, process a BATCH of links (e.g. 10), then close.
    // This balances speed (less startup overhead) with stability (regular cleanup).

    let browser = null;
    let page = null;

    try {
        // Launch browser ONCE for the whole batch
        browser = await puppeteer.launch({
            headless: isHeadless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            defaultViewport: null,
            protocolTimeout: 120000
        });

        const context = browser.defaultBrowserContext();
        await context.overridePermissions(links[0].url, ['notifications']); // Optional permission fix

        // Loop through links using the SAME browser
        for (const link of links) {
            try {
                // ... (Processing Logic)

                // Mark PROCESSING
                await prisma.link.update({ where: { id: link.id }, data: { status: "PROCESSING", error: null } });
                await logToDB(`Processing: ${link.url}`, "INFO");

                page = await browser.newPage();

                // Randomize User Agent
                const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
                await page.setUserAgent(randomUA);

                // Initialize Ghost Cursor
                const cursor = createCursor(page);

                // --- 1. NAVIGATE (FAIL FAST) ---
                try {
                    await page.goto(link.url, { waitUntil: "domcontentloaded", timeout: 15000 }); // 15s Timeout, domcontentloaded is faster
                } catch (e) {
                    throw new Error(`TIMEOUT: Site took too long`);
                }

                // --- 2. CAPTCHA CHECK (FAIL FAST) ---
                try {
                    const captchaSelectors = [
                        'iframe[src*="recaptcha"]',
                        'iframe[src*="captcha"]',
                        '#g-recaptcha-response',
                        '.g-recaptcha',
                        'input[name="recaptcha_response_field"]',
                        '#captcha',
                        '[class*="captcha"]'
                    ];

                    // Quick scan - 1s timeout equivalent (evaluate is instant)
                    const foundCaptcha = await page.evaluate((selectors) => {
                        return selectors.some(s => document.querySelector(s));
                    }, captchaSelectors);

                    if (foundCaptcha) {
                        throw new Error("SKIP_CAPTCHA");
                    }
                } catch (e: any) {
                    if (e.message === "SKIP_CAPTCHA") throw e;
                }

                // --- 3. FILL FORM ---
                let fieldFound = false;
                for (const field of fields) {
                    const searchTerms = [field.name, field.label];
                    // Enhance search terms based on field type names
                    if (field.name.toLowerCase().includes("name")) searchTerms.push("author", "firstname", "first_name", "last_name", "user", "nick");
                    if (field.name.toLowerCase().includes("message")) searchTerms.push("comment", "description", "body", "details", "text", "msg");
                    if (field.name.toLowerCase().includes("email")) searchTerms.push("mail", "e-mail", "contact");

                    // Broad selectors
                    const selectors = searchTerms.flatMap(term => [
                        `input[name*="${term}" i]`,
                        `input[id*="${term}" i]`,
                        `input[placeholder*="${term}" i]`,
                        `textarea[name*="${term}" i]`,
                        `textarea[id*="${term}" i]`,
                        `textarea[placeholder*="${term}" i]`
                    ]).join(", ");

                    try {
                        const element = await page.waitForSelector(selectors, { timeout: 2000 }); // Fast 2s search
                        if (element) {
                            if (!fieldFound) await cursor.move(element); // Move cursor to first element found

                            try {
                                await element.click({ clickCount: 3 }); // Select all
                                await element.press('Backspace');   // Clear
                            } catch (e) { }

                            await element.type(field.value, { delay: 5 }); // Fast typing
                            fieldFound = true;
                        }
                    } catch (e) { }
                }

                if (!fieldFound) {
                    throw new Error("SKIP_NO_FIELDS"); // No matching fields found
                }

                // --- 4. SUBMIT ---
                let submitted = false;
                const textTargets = ["Submit", "Send", "Post", "Contact", "Message", "Go", "Comment", "Reply"];

                // Try clicking buttons with specific text
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
                                    await new Promise(r => setTimeout(r, 1000));
                                    break;
                                }
                            } catch (e) { }
                        }
                    } catch (e) { }
                }

                // Try generic submit buttons
                if (!submitted) {
                    const submitSelectors = [
                        'button[type="submit"]',
                        'input[type="submit"]',
                        'button[class*="submit" i]',
                        'button[class*="btn-primary" i]',
                    ];
                    for (const selector of submitSelectors) {
                        try {
                            const btn = await page.$(selector);
                            if (btn && await btn.boundingBox()) {
                                await cursor.click(btn);
                                submitted = true;
                                await new Promise(r => setTimeout(r, 1000));
                                break;
                            }
                        } catch (e) { }
                    }
                }

                // JS Force Submit
                if (!submitted) {
                    submitted = await page.evaluate(() => {
                        const form = document.querySelector('form');
                        if (form) {
                            form.requestSubmit ? form.requestSubmit() : form.submit();
                            return true;
                        }
                        return false;
                    });
                    await new Promise(r => setTimeout(r, 1500));
                }

                // --- 5. CHECK SUCCESS ---
                try {
                    const pageContent = (await page.content()).toLowerCase();

                    if (pageContent.includes("duplicate") || pageContent.includes("already said that")) {
                        // User requested "Blind Submit" - if it says duplicate, it means we (or someone) executed it. 
                        // Treat as SUCCESS.
                        console.log("Duplicate detected - marking as SUCCESS per user request.");
                        // Fall through to success capture
                    }
                    if (pageContent.includes("captcha") || pageContent.includes("prove you are human")) {
                        throw new Error("SKIP_CAPTCHA_BLOCK");
                    }

                    // --- CAPTURE PROOF (SCREENSHOT & URL) ---
                    const finalUrl = page.url();
                    const screenshotDir = "./public/screenshots";
                    if (!fs.existsSync(screenshotDir)) {
                        fs.mkdirSync(screenshotDir, { recursive: true });
                    }
                    const screenshotFilename = `proof-${link.id}.webp`;
                    const screenshotPath = `${screenshotDir}/${screenshotFilename}`;

                    try {
                        await page.screenshot({ path: screenshotPath, type: 'webp', quality: 50 });
                    } catch (e) { console.error("Screenshot failed", e); }

                    // Save to DB
                    // Path stored is relative to public (e.g., "/screenshots/proof-123.webp")
                    const dbScreenshotPath = `/screenshots/${screenshotFilename}`;

                    await prisma.link.update({
                        where: { id: link.id },
                        data: {
                            status: "SUCCESS",
                            error: null,
                            submittedUrl: finalUrl,
                            screenshotPath: dbScreenshotPath
                        }
                    });
                    await logToDB(`SUCCESS: ${link.url}`, "SUCCESS");

                } catch (error: any) {
                    // Check for navigation errors (success redirect can cause these sometimes)
                    const emsg = error.message || "";
                    if (emsg.includes("Execution context was destroyed") || emsg.includes("Protocol error") || emsg.includes("Target closed")) {
                        // Even on redirect error, try to mark as success if we got far enough, but no screenshot
                        await prisma.link.update({ where: { id: link.id }, data: { status: "SUCCESS", error: null, submittedUrl: page?.url() || "Redirected" } });
                        await logToDB(`SUCCESS (Redirected): ${link.url}`, "SUCCESS");
                    } else {
                        throw error;
                    }
                }

            } catch (error: any) {
                // Categorize Errors
                let status = "FAILED";
                const msg = error.message || "Unknown error";

                if (msg.includes("SKIP_CAPTCHA")) {
                    await logToDB(`Skipped (Captcha): ${link.url}`, "WARN");
                } else if (msg.includes("SKIP_NO_FIELDS")) {
                    await logToDB(`Skipped (No Fields): ${link.url}`, "WARN");
                } else if (msg.includes("TIMEOUT")) {
                    await logToDB(`Timeout: ${link.url}`, "WARN");
                } else {
                    await logToDB(`Failed: ${link.url} - ${msg}`, "ERROR");
                }

                await prisma.link.update({
                    where: { id: link.id },
                    data: { status: status, error: msg }
                });

            } finally {
                // FORCE KILL BROWSER AFTER EVERY LINK
                if (page) try { await page.close(); } catch (e) { }
                if (browser) try { await browser.close(); } catch (e) { }
            }
        } // End Loop

        return { processed: links.length, status: "ACTIVE" };
    }
