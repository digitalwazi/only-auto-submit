
import { Page } from 'puppeteer';
import { PageFeatures } from './types';

export class PageScanner {

    async scan(page: Page): Promise<PageFeatures> {
        const hasCaptcha = await this.checkForCaptcha(page);
        const hasWordPress = await this.checkForWordPress(page);

        return {
            hasCaptcha,
            hasOverlay: false, // Just a default, tracked during dismissal
            hasWordPress
        };
    }

    async checkForCaptcha(page: Page): Promise<boolean> {
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

            const found = await page.evaluate((selectors) => {
                return selectors.some(s => document.querySelector(s));
            }, captchaSelectors);

            return found;
        } catch (e) {
            return false;
        }
    }

    async checkForWordPress(page: Page): Promise<boolean> {
        try {
            const wpElement = await page.$('#commentform');
            return !!wpElement;
        } catch (e) { return false; }
    }

    async handleOverlays(page: Page) {
        try {
            console.log("[PageScanner] Checking for overlays/popups...");
            const overlaySelectors = [
                // Buttons with specific text
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'no thanks')]",
                "//div[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'no thanks')]",
                "//span[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'no thanks')]",
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'maybe later')]",
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'deny')]",
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'close')]",
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'dismiss')]",
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'not now')]",
                // Common aria-labels
                "button[aria-label='Close']",
                "button[aria-label='close']",
                "div[aria-label='Close']",
                // Common class names
                ".close-button",
                ".btn-close",
                ".popup-close"
            ];

            for (const sel of overlaySelectors) {
                try {
                    const elements = sel.startsWith("//")
                        ? await page.$$(`xpath/${sel}`)
                        : await page.$$(sel);

                    if (elements.length > 0) {
                        const el = elements[0] as any;
                        if (await el.boundingBox()) {
                            console.log(`[PageScanner] Dismissing overlay: ${sel}`);
                            await el.click();
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                } catch (e) { }
            }
        } catch (e) { console.warn("[PageScanner] Overlay check warning:", e); }
    }
}
