
import puppeteer from 'puppeteer-extra';

const TARGET_URL = 'https://bundlewp.com/gjftj';

async function testSubmission() {
    console.log("=== STARTING LIVE TEST ===");
    console.log(`Target: ${TARGET_URL}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    console.log("Browser launched.");
    const page = await browser.newPage();

    try {
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        console.log("Navigating...");
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log("Page loaded.");

        // 1. OVERLAY CHECK
        console.log("Checking for overlays...");

        // Try clicking generic close buttons
        try {
            const overlaySelectors = [
                "button[aria-label='Close']",
                ".close-button",
                ".btn-close",
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'no thanks')]"
            ];

            for (const sel of overlaySelectors) {
                const els = sel.startsWith("//") ? await page.$x(sel) : await page.$$(sel);
                if (els.length > 0) {
                    console.log(`Found overlay candidate: ${sel}, clicking...`);
                    await els[0].click();
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        } catch (e) {
            console.log("Overlay check warning: " + e.message);
        }

        // 2. FORM FINDING
        console.log("Looking for form...");
        const commentForm = await page.$('#commentform');
        if (!commentForm) {
            console.error("FATAL: #commentform NOT FOUND");
            const html = await page.content();
            console.log("HTML Start: " + html.substring(0, 500));
        } else {
            console.log("Found #commentform.");

            // 3. FILLING
            console.log("Filling fields...");
            try {
                await page.if('#comment', el => el.value = ''); // Clear
                await page.type('#comment', "Test comment processing check " + Date.now());
                await page.type('#author', "Test User");
                await page.type('#email', "test@example.com");
            } catch (e) {
                console.log("Error filling fields (might be logged in?): " + e.message);
            }

            // 4. SUBMITTING
            console.log("Attempting submission...");
            const submitBtn = await commentForm.$('#submit');

            let clicked = false;
            if (submitBtn) {
                console.log("Found #submit button. Clicking...");
                try {
                    await Promise.all([
                        page.waitForNavigation({ timeout: 10000 }).catch(() => console.log("Nav timeout ignored (checking content)")),
                        submitBtn.click()
                    ]);
                    clicked = true;
                } catch (e) {
                    console.log("Click failed: " + e.message);
                }
            }

            if (!clicked) {
                console.log("No #submit button found or click failed. Trying JS Force...");
                await page.evaluate(() => {
                    const f = document.querySelector('#commentform');
                    if (f) f.submit();
                });
                console.log("JS Submit called. Waiting...");
                await new Promise(r => setTimeout(r, 5000));
            } else {
                await new Promise(r => setTimeout(r, 3000));
            }

            const finalUrl = page.url();
            console.log("Final URL: " + finalUrl);

            const content = await page.content();
            const lower = content.toLowerCase();

            if (lower.includes("thank") || lower.includes("moderation") || lower.includes("posted")) {
                console.log("SUCCESS DETECTED in content.");
            } else if (finalUrl === TARGET_URL && !lower.includes("error")) { // Heuristic
                console.log("URL unchanged. Checking for error messages...");
                if (lower.includes("spam") || lower.includes("security")) {
                    console.log("Result: BLOCKED/SPAM detected.");
                } else {
                    console.log("Result: AMBIGUOUS (No change, no error). Likely 'Content Unchanged' failure.");
                }
            } else {
                console.log("NO SUCCESS MESSAGE FOUND.");
            }
        }

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
    } finally {
        await browser.close();
        console.log("Browser closed.");
    }
}

testSubmission();
