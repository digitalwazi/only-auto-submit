import puppeteer from "puppeteer";
import prisma from "./prisma";
import { getSettings } from "./settings";

export async function processCampaign(campaignId: string) {
    // 1. Check Global Kill Switch & Concurrency
    const settings = await getSettings();
    if (!settings.isWorkerOn) {
        console.log("Worker is globally paused.");
        return;
    }

    const concurrency = settings.concurrency || 1;

    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
    });

    if (!campaign || campaign.status !== "RUNNING") return;

    const fields = JSON.parse(campaign.fields);

    // Process a batch based on concurrency limit
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
        }
        return;
    }

    // Launch browser (Headless for production)
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
        defaultViewport: null
    });

    // Parallel Processing
    try {
        await Promise.all(links.map(async (link) => {
            let page;
            try {
                // Clear previous errors when starting
                await prisma.link.update({ where: { id: link.id }, data: { status: "PROCESSING", error: null } });

                page = await browser.newPage();
                // Set a realistic user agent
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                await page.goto(link.url, { waitUntil: "networkidle2", timeout: 45000 });

                let fieldFound = false;
                for (const field of fields) {
                    // Intelligent Mapping for WordPress & Common Variations
                    const searchTerms = [field.name, field.label];
                    if (field.name.toLowerCase().includes("name")) searchTerms.push("author", "firstname", "first_name", "last_name", "user");
                    if (field.name.toLowerCase().includes("message")) searchTerms.push("comment", "description", "body", "details");
                    if (field.name.toLowerCase().includes("email")) searchTerms.push("mail", "e-mail");

                    // Construct complex selector
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
                            try {
                                // Clear existing content (safer method)
                                await element.click({ clickCount: 3 });
                                await element.press('Backspace');
                            } catch (e) { }

                            // Type with delay to mimic human
                            await element.type(field.value, { delay: 50 });
                            fieldFound = true;
                        }
                    } catch (e) {
                        // console.log(`Field ${field.name} not found`);
                    }
                }

                if (!fieldFound) {
                    throw new Error("No matching form fields found");
                }

                // Strategy 1: Press ENTER in the last focused field
                try {
                    await page.keyboard.press('Enter');
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) { }

                // Submit strategies
                let submitted = false;

                // Strategy 2: Identify button by Text Content (XPath) - Most reliable for "Submit Comment", "Post", etc.
                const textTargets = ["Submit", "Send", "Post", "Contact", "Message", "Go", "Comment"];
                for (const text of textTargets) {
                    if (submitted) break;
                    try {
                        // XPath to find buttons or inputs with specific text, case-insensitive logic
                        // .//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'submit')]
                        const xpath = `//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')] | //input[@type='submit' and contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;

                        const elements = await page.$x(xpath);
                        for (const element of elements) {
                            try {
                                const isVisible = await element.boundingBox();
                                if (isVisible) {
                                    await element.click();
                                    submitted = true;
                                    await new Promise(r => setTimeout(r, 2000)); // Wait for reaction
                                    break;
                                }
                            } catch (e) { }
                        }
                    } catch (e) { }
                }

                // Strategy 3: Generic CSS Selectors
                if (!submitted) {
                    const submitSelectors = [
                        'button[type="submit"]',
                        'input[type="submit"]',
                        'button[class*="submit" i]',
                        'button[class*="send" i]',
                        'button[class*="btn-primary" i]', // Common framework class
                        'button:not([type="button"]):not([type="reset"])',
                    ];

                    for (const selector of submitSelectors) {
                        try {
                            const btn = await page.$(selector);
                            if (btn) {
                                // Verify visibility
                                const box = await btn.boundingBox();
                                if (box) {
                                    await btn.click();
                                    submitted = true;
                                    await new Promise(r => setTimeout(r, 2000));
                                    break;
                                }
                            }
                        } catch (e) { }
                    }
                }

                // Strategy 4: Fallback JS Submit (only if really desperate)
                if (!submitted) {
                    submitted = await page.evaluate(() => {
                        const form = document.querySelector('form');
                        if (form) {
                            form.requestSubmit ? form.requestSubmit() : form.submit(); // requestSubmit() triggers events
                            return true;
                        }
                        return false;
                    });
                    await new Promise(r => setTimeout(r, 2000));
                }

                // Verify Submission Success - Check for "Duplicate", "Error", etc.
                const pageContent = await page.content();
                const lowerContent = pageContent.toLowerCase();

                if (lowerContent.includes("duplicate comment") || lowerContent.includes("looks like you've already said that")) {
                    throw new Error("FAIL_DUPLICATE: Duplicate submission detected");
                }
                if (lowerContent.includes("captcha") || lowerContent.includes("prove you are human")) {
                    throw new Error("FAIL_CAPTCHA: Blocked by CAPTCHA");
                }

                // If good:
                await prisma.link.update({ where: { id: link.id }, data: { status: "SUCCESS", error: null } });

            } catch (error: any) {
                console.error(`Error processing ${link.url}:`, error);
                await prisma.link.update({
                    where: { id: link.id },
                    data: { status: "FAILED", error: error.message || "Unknown error" }
                });
            } finally {
                if (page) await page.close();
            }
        }));
    } finally {
        await browser.close();
    }
}
