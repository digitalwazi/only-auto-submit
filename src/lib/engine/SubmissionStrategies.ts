
import { Page } from 'puppeteer';

export class SubmissionStrategies {
    async execute(page: Page, beforeSubmitUrl: string, beforeSubmitContent: string): Promise<boolean> {
        let submitted = false;

        // Strategy 1: Enter Key (Low risk, quick check)
        try {
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) { }

        // Strategy 2: WordPress Nuclear (High Priority & Robust)
        submitted = await this.tryWordPress(page, beforeSubmitUrl, beforeSubmitContent);
        if (submitted) return true;

        // Strategy 3: Generic Buttons
        submitted = await this.tryGenericButtons(page);

        return submitted;
    }

    private async tryWordPress(page: Page, beforeUrl: string, beforeContent: string): Promise<boolean> {
        try {
            const wpForm = await page.$('#commentform');
            if (wpForm) {
                console.log("[Submission] WordPress form detected.");

                // 1. Try Click first
                const wpSubmit = await wpForm.$('#submit');
                if (wpSubmit) {
                    await wpSubmit.click();
                    console.log("[Submission] Clicked WP #submit button.");
                    await new Promise(r => setTimeout(r, 2000));
                }

                // 2. CHECK: did it work?
                const currentUrl = page.url();
                const currentContent = await page.content();
                if (currentUrl === beforeUrl && currentContent === beforeContent) {
                    console.log("[Submission] WP Click failed. Executing NUCLEAR OPTION (JS form.submit)...");
                    await page.evaluate(() => {
                        const form = document.querySelector('#commentform') as HTMLFormElement;
                        if (form) form.submit();
                    });
                    await new Promise(r => setTimeout(r, 5000));
                }
                return true;
            }
        } catch (e) { }
        return false;
    }

    private async tryGenericButtons(page: Page): Promise<boolean> {
        const textTargets = ["Submit", "Send", "Post", "Contact", "Message", "Go", "Comment", "Reply", "Send Message"];

        // 1. Text Search (XPath)
        for (const text of textTargets) {
            try {
                const xpath = `//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')] | //input[@type='submit' and contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')] | //span[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;
                const elements = await page.$$(`xpath/${xpath}`);
                for (const element of elements) {
                    const el = element as any;
                    if (await el.boundingBox()) {
                        await el.click();
                        console.log(`[Submission] Clicked button with text: ${text}`);
                        await new Promise(r => setTimeout(r, 5000));
                        return true;
                    }
                }
            } catch (e) { }
        }

        // 2. CSS Selectors (Fallback)
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
                if (btn && await btn.boundingBox()) {
                    await btn.click();
                    console.log(`[Submission] Clicked button with selector: ${selector}`);
                    await new Promise(r => setTimeout(r, 5000));
                    return true;
                }
            } catch (e) { }
        }

        // 3. Final Resort: JS Check
        try {
            await page.evaluate(() => {
                const form = document.querySelector('form');
                if (form) {
                    if (form.requestSubmit) form.requestSubmit();
                    else form.submit();
                }
            });
            await new Promise(r => setTimeout(r, 5000));
            return true; // We tried our best
        } catch (e) { }

        return false;
    }
}
