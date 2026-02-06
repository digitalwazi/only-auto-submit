
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, Browser } from 'puppeteer';

// Register plugins lazily to prevent build-time side effects
let pluginsRegistered = false;

export class BrowserManager {
    private browser: Browser | null = null;

    /**
     * Launch or return existing browser instance.
     * Implements the "Fresh Browser" or "Optimized" strategy based on usage.
     * Currently configured for MAXIMUM STABILITY (Single Process / Reduced overhead).
     */
    async launch(headless: boolean = true): Promise<Browser> {
        // REGISTER PLUGINS HERE (Runtime only)
        if (!pluginsRegistered) {
            try {
                puppeteer.use(StealthPlugin());
                pluginsRegistered = true;
            } catch (e) { console.error("Plugin reg error", e); }
        }

        if (this.browser) return this.browser;

        console.log('[BrowserManager] Launching new browser instance...');
        try {
            this.browser = await puppeteer.launch({
                headless,
                // Use system Chrome for reliability on VPS
                executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--no-zygote',
                    // REMOVED: '--single-process' - causes startup timeout on Linux
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-features=site-per-process',
                    // MEMORY LIMITS
                    '--js-flags=--max-old-space-size=256',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--mute-audio',
                    '--no-default-browser-check',
                ],
                defaultViewport: { width: 1280, height: 720 },
                protocolTimeout: 120000, // Increased from 60s
                timeout: 60000 // Increased from 30s
            }) as unknown as Browser;
            console.log('[BrowserManager] Browser launched successfully');
        } catch (e) {
            console.error('[BrowserManager] Fatal Launch Error:', e);
            throw e;
        }

        return this.browser;
    }

    /**
     * Create a new page with standard protections and overrides.
     */
    async newPage(browser: Browser): Promise<Page> {
        try {
            const page = await browser.newPage();

            // Standard Anti-Detect improvements
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

            // Set extra headers if needed
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
            });

            return page;
        } catch (e) {
            console.error('[BrowserManager] Error creating new page:', e);
            throw e;
        }
    }

    /**
     * Force close the browser instance.
     */
    async close() {
        if (this.browser) {
            console.log('[BrowserManager] Closing browser...');
            try {
                await this.browser.close();
            } catch (e) {
                console.warn('[BrowserManager] Error closing browser (might be already closed):', e);
            }
            this.browser = null;
        }
    }
}
