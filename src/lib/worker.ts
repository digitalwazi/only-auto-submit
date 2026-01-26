import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha";
import { createCursor } from "ghost-cursor";
import prisma from "./prisma";
import { getSettings } from "./settings";
import { logToDB } from "./logs";
import fs from "fs";
import path from "path";

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

    if (!campaign) {
        // console.log("No RUNNING campaign found.");
        return { processed: 0, status: "IDLE" };
    }
    console.log(`[Worker] Found Campaign: ${campaign.name} (${campaign.id})`);

    // Per-campaign Headless Override
    const isHeadless = campaign.headless !== false;
    let fields;
    try {
        fields = JSON.parse(campaign.fields);
    } catch (e) {
        console.error(`[Worker] Failed to parse fields for campaign ${campaign.id}`, e);
        return { processed: 0, status: "FAILED_FIELDS" };
    }

    // Get a batch of PENDING links
    const links = await prisma.link.findMany({
        where: { campaignId: campaign.id, status: "PENDING" },
        take: concurrency,
    });

    console.log(`[Worker] Found ${links.length} PENDING links for current batch.`);

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

    // --- FRESH BROWSER PER BATCH ARCHITECTURE ---

    try {
        console.log(`[Worker] Launching Browser...`);

        // Launch with strict timeout
        browser = await Promise.race([
            puppeteer.launch({
                headless: isHeadless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process', // RAM saver
                    '--disable-gpu',
                    '--disable-features=site-per-process', // Critical for VPS memory
                    '--disk-cache-dir=/tmp/puppeteer-cache' // Move cache off disk if possible
                ],
                defaultViewport: null,
                protocolTimeout: 60000,
                timeout: 30000 // 30s Launch Timeout
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("LAUNCH_TIMEOUT")), 35000))
        ]) as any;

        if (!browser) throw new Error("Browser failed to launch (Buffer mismatch)");

        console.log(`[Worker] Browser Launched. Opening Context...`);
        const context = browser.defaultBrowserContext();

        // Loop through links using the SAME browser instance
        for (const link of links) {
            try {
                // Mark PROCESSING
                await prisma.link.update({ where: { id: link.id }, data: { status: "PROCESSING", error: null } });
                await logToDB(`Processing: ${link.url}`, "INFO");

                // Page Creation Timeout
                page = await Promise.race([
                    browser.newPage(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("NEW_PAGE_TIMEOUT")), 10000))
                ]) as any;

                // Randomize User Agent
                const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
                await page.setUserAgent(randomUA);

                // Initialize Ghost Cursor (Can hang on low mem, using basic clicks for now if needed, but keeping for stealth)
                // const cursor = createCursor(page); // Keeping for now, but be verifying
                const cursor = createCursor(page);

                // --- 1. NAVIGATE (FAIL FAST) ---
                try {
                    await page.goto(link.url, { waitUntil: "domcontentloaded", timeout: 8000 }); // 8s Timeout (User requested "immediately")
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

                            // DISPATCH EVENTS for React/Vue/Angular
                            await page.evaluate((el: any) => {
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                                el.dispatchEvent(new Event('blur', { bubbles: true }));
                            }, element);

                            fieldFound = true;
                        }
                    } catch (e) { }
                }

                if (!fieldFound) {
                    // Fallback: Try to find ANY visible textarea for the message
                    const messageField = fields.find(f => f.name.includes("message") || f.name.includes("comment"));
                    if (messageField) {
                        try {
                            const fallbackSelector = 'textarea, div[contenteditable="true"]';
                            const elements = await page.$$(fallbackSelector);
                            for (const el of elements) {
                                if (await el.boundingBox()) {
                                    // Check if emptiness
                                    const text = await page.evaluate((e: any) => e.value || e.innerText, el);
                                    if (!text || text.length < 5) {
                                        await cursor.click(el);
                                        await el.type(messageField.value, { delay: 5 });
                                        await page.evaluate((e: any) => {
                                            e.dispatchEvent(new Event('input', { bubbles: true }));
                                            e.dispatchEvent(new Event('change', { bubbles: true }));
                                        }, el);
                                        fieldFound = true;
                                        break;
                                    }
                                }
                            }
                        } catch (e) { }
                    }
                }

                if (!fieldFound) {
                    throw new Error("SKIP_NO_FIELDS"); // No matching fields found
                }

                // --- 4. SUBMIT ---
                // --- 4. IMPROVED SUBMIT STRATEGY ---
                let submitted = false;
                const beforeSubmitContent = await page.content();
                const beforeSubmitUrl = page.url();

                // Strategy A: Press ENTER on the last active element
                try {
                    await page.keyboard.press('Enter');
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) { }

                // Strategy B: Click Submit Buttons
                const textTargets = ["Submit", "Send", "Post", "Contact", "Message", "Go", "Comment", "Reply", "Send Message"];
                for (const text of textTargets) {
                    if (submitted) break;
                    try {
                        // Case insensitive XPath for buttons or inputs with specific text
                        const xpath = `//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')] | //input[@type='submit' and contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')] | //span[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;
                        const elements = await page.$$(`xpath/${xpath}`);
                        for (const element of elements) {
                            try {
                                if (await element.boundingBox()) {
                                    // Ensure it's visible and clickable
                                    await cursor.move(element); // Move first
                                    await cursor.click(element);
                                    submitted = true;
                                    console.log(`[Worker] Clicked button with text: ${text}`);
                                    await new Promise(r => setTimeout(r, 5000)); // Wait 5s for network/nav
                                    break;
                                }
                            } catch (e) { }
                        }
                    } catch (e) { }
                }

                // Strategy C: Generic Selectors
                if (!submitted) {
                    const submitSelectors = [
                        'button[type="submit"]',
                        'input[type="submit"]',
                        'button[class*="submit" i]',
                        'button[class*="btn-primary" i]',
                        'form button:not([type="button"])', // Default button in form is submit
                    ];
                    for (const selector of submitSelectors) {
                        try {
                            const btn = await page.$(selector);
                            if (btn && await btn.boundingBox()) {
                                await cursor.move(btn);
                                await cursor.click(btn);
                                submitted = true;
                                console.log(`[Worker] Clicked button with selector: ${selector}`);
                                await new Promise(r => setTimeout(r, 5000));
                                break;
                            }
                        } catch (e) { }
                    }
                }

                // Strategy D: JS Force RequestSubmit (Triggers validation)
                if (!submitted) {
                    console.log("[Worker] No submit button found, trying JS submit...");
                    await page.evaluate(() => {
                        const form = document.querySelector('form');
                        if (form) {
                            if (form.requestSubmit) form.requestSubmit();
                            else form.submit();
                        }
                    });
                    await new Promise(r => setTimeout(r, 5000));
                }

                // --- 5. VERIFY SUBMISSION (CRITICAL FIX) ---
                // --- 5. VERIFY SUBMISSION (STRICT MODE) ---
                let afterSubmitContent = await page.content();
                const afterSubmitUrl = page.url();
                const pageContentLower = afterSubmitContent.toLowerCase();

                // 5a. FAIL_FAST: Check for explicit ERROR keywords immediately
                // Even if URL changed, an error might be displayed on the new page.
                const errorKeywords = [
                    "captcha",
                    "error",
                    "invalid",
                    "spam",
                    "prove you are human",
                    "blocked",
                    "forbidden",
                    "too fast",
                    "duplicate comment" // Treat as pseudo-success or fail depending on preference? usually fail for reporting.
                ];

                const foundError = errorKeywords.find(k => pageContentLower.includes(k));
                if (foundError) {
                    // Special case: "Duplicate" might be acceptable if we want to confirm it WAS submitted.
                    // But usually, it means THIS attempt failed.
                    if (foundError.includes("duplicate")) {
                        console.log("[Worker] Duplicate detected. Marking as SUCCESS (Already submitted).");
                    } else {
                        throw new Error(`SUBMIT_FAILED: Found error keyword '${foundError}' on result page.`);
                    }
                }

                // 5b. SUCCESS CHECKS
                let isSuccess = false;
                let successReason = "";

                // Check 1: Explicit Success Keywords
                const successKeywords = [
                    "comment awaiting moderation",
                    "your comment is awaiting moderation",
                    "thank you",
                    "comment submitted",
                    "successfully",
                    "was added",
                    "pending approval"
                ];
                const foundSuccess = successKeywords.find(k => pageContentLower.includes(k));

                if (foundSuccess) {
                    isSuccess = true;
                    successReason = `Found keyword: "${foundSuccess}"`;
                }

                // Check 2: Output Validation (Did our unique text appear?)
                // (Only works if comment is auto-approved)
                // const messageField = fields.find(f => f.name.includes("message"));
                // if (messageField && pageContentLower.includes(messageField.value.toLowerCase())) {
                //    isSuccess = true; 
                //    successReason = "Comment text found on page";
                // }

                // Check 3: URL Change (Fallback, but stricter now because we checked for errors first)
                if (!isSuccess && beforeSubmitUrl !== afterSubmitUrl) {
                    // If URL changed and NO error keywords found -> Assume Success (Redirect)
                    isSuccess = true;
                    successReason = "URL Changed (No errors detected)";
                }

                if (!isSuccess) {
                    // If Content is same AND Url is same -> It failed.
                    if (beforeSubmitContent === afterSubmitContent) {
                        throw new Error("SUBMIT_FAILED: Content unchanged after submit.");
                    }

                    // If Content changed but URL didn't, and no success keywords?
                    // It's ambiguous. Let's look for known failure patterns again or default to WARN?
                    // For now, strict mode says: IF unsure, FAILED.
                    // But often AJAX forms just clear the box.

                    // Check if form was cleared?
                    // (Too complex for generic).

                    // FALLBACK: If we didn't find an error, assume success?
                    // NO, user complained about false positives. 
                    // Throw error if we can't prove success.
                    throw new Error("SUBMIT_FAILED: Could not verify success (No success message, URL didn't change).");
                }


                // --- 6. CAPTURE PROOF (Fixed Path) ---
                console.log(`[Worker] Verifying Success: ${successReason}`);

                const finalUrl = page.url();
                const screenshotDir = path.join(process.cwd(), 'public', 'screenshots');

                if (!fs.existsSync(screenshotDir)) {
                    fs.mkdirSync(screenshotDir, { recursive: true });
                }

                const screenshotFilename = `proof-${link.id}-${Date.now()}.webp`; // Add timestamp to avoid cache
                const screenshotPath = path.join(screenshotDir, screenshotFilename);

                try {
                    await page.screenshot({ path: screenshotPath, type: 'webp', quality: 50 });
                } catch (e) { console.error("Screenshot failed", e); }

                // Save to DB (Relative path for frontend)
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
                await logToDB(`SUCCESS: ${link.url} [${successReason}]`, "SUCCESS");

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
            // Close Page, keep Browser open for next link in batch
            if (page) try { await page.close(); } catch (e) { }
        }
    } // End Link Loop

    } catch (e) {
    console.error("Critical Worker Error:", e);
} finally {
    // Close Browser after batch
    if (browser) try { await browser.close(); } catch (e) { }
}

return { processed: links.length, status: "ACTIVE" };
}
