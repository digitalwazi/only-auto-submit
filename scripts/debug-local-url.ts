
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createCursor } from 'ghost-cursor';

// Mock DB Log for script
function logToDB(msg: string, type: string) {
    console.log(`[${type}] ${msg}`);
}

puppeteer.use(StealthPlugin());

const TARGET_URL = "https://bundlewp.com/gjftj/";
const FIELDS = [
    { name: "name", label: "Full Name", value: `Bundle WP Tester ${Date.now()}` },
    { name: "email", label: "Email Address", value: `test${Date.now()}@bundlewp.com` },
    { name: "message", label: "Message", value: `This is a test message to verify auto-submit functionality. ID: ${Date.now()}` }
];

async function run() {
    console.log(`Testing URL: ${TARGET_URL}`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const cursor = createCursor(page);

    try {
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
        console.log("Page Loaded");

        let fieldFound = false;
        for (const field of FIELDS) {
            const searchTerms = [field.name, field.label];
            if (field.name.toLowerCase().includes("name")) searchTerms.push("author", "firstname", "first_name", "last_name", "user", "nick");
            if (field.name.toLowerCase().includes("message")) searchTerms.push("comment", "description", "body", "details", "text", "msg");
            if (field.name.toLowerCase().includes("email")) searchTerms.push("mail", "e-mail", "contact");

            const selectors = searchTerms.flatMap(term => [
                `input[name*="${term}" i]`,
                `input[id*="${term}" i]`,
                `input[placeholder*="${term}" i]`,
                `textarea[name*="${term}" i]`,
                `textarea[id*="${term}" i]`,
                `textarea[placeholder*="${term}" i]`
            ]).join(", ");

            try {
                const element = await page.waitForSelector(selectors, { timeout: 2000 });
                if (element) {
                    console.log(`Found field for ${field.name}`);
                    await cursor.click(element);
                    await element.type(field.value, { delay: 10 });
                    fieldFound = true;
                }
            } catch (e) {
                console.log(`Could not find field for ${field.name}`);
            }
        }

        if (!fieldFound) {
            // Fallback for message
            console.log("Trying fallback for message...");
            try {
                const fallbackSelector = 'textarea, div[contenteditable="true"]';
                const el = await page.$(fallbackSelector);
                if (el) {
                    await cursor.click(el);
                    await el.type("Fallback Message content", { delay: 10 });
                    console.log("Fallback message filled");
                }
            } catch (e) { }
        }

        await new Promise(r => setTimeout(r, 2000));

        // Submit logic
        console.log("Attempting Submit...");
        let submitted = false;

        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button[class*="submit" i]',
            'button[class*="btn-primary" i]',
            'form button:not([type="button"])',
        ];

        for (const selector of submitSelectors) {
            try {
                const btn = await page.$(selector);
                if (btn) {
                    console.log(`Found submit button: ${selector}`);
                    await cursor.click(btn);
                    submitted = true;
                    break;
                }
            } catch (e) { }
        }

        if (!submitted) {
            console.log("Trying text-based submit search...");
            const textTargets = ["Submit", "Send", "Post", "Comment", "Reply"];
            for (const text of textTargets) {
                const xpath = `//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;
                const elements = await page.$$(`xpath/${xpath}`);
                if (elements.length > 0) {
                    console.log(`Found submit by text: ${text}`);
                    await cursor.click(elements[0]);
                    submitted = true;
                    break;
                }
            }
        }

        if (submitted) {
            console.log("Clicked Submit. Waiting 5s...");
            await new Promise(r => setTimeout(r, 5000));

            const afterSubmitContent = await page.content();
            const afterSubmitUrl = page.url();
            const pageContentLower = afterSubmitContent.toLowerCase();

            console.log("--- POST-SUBMIT VERIFICATION ---");
            console.log("Previous URL:", TARGET_URL);
            console.log("Current URL: ", afterSubmitUrl);

            // 1. FAIL_FAST CHECK
            const errorKeywords = [
                "captcha", "error", "invalid", "spam", "prove you are human", "blocked", "forbidden"
            ];
            const foundError = errorKeywords.find(k => pageContentLower.includes(k));
            if (foundError) {
                console.error(`FAILED: Found error keyword '${foundError}' on result page.`);
                return;
            }

            // 2. SUCCESS CHECKS
            let isSuccess = false;
            let successReason = "";

            // Check A: Success Keywords
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

            // Check B: URL Change (Strict)
            if (!isSuccess && TARGET_URL !== afterSubmitUrl) {
                isSuccess = true;
                successReason = "URL Changed (No errors detected)";
            }

            // Check C: Content Verification (Loose)
            if (!isSuccess) {
                if (afterSubmitContent.includes("Bundle WP Tester")) {
                    isSuccess = true;
                    successReason = "Comment text found on page";
                }
            }

            if (isSuccess) {
                console.log(`SUCCESS VERIFIED: ${successReason}`);
            } else {
                console.error("FAILED: Could not verify success (No success message, URL didn't change).");
                console.log("Sample Content:", afterSubmitContent.slice(0, 500));
            }

            console.log("Done.");
        } else {
            console.log("FAILED to find submit button");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        // await browser.close();
    }
}

run();
