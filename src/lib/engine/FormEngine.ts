
import { Page, ElementHandle } from 'puppeteer';
import { CampaignField } from './types';

export class FormEngine {

    async fillForm(page: Page, fields: CampaignField[]): Promise<boolean> {
        let fieldFound = false;

        for (const field of fields) {
            const searchTerms = [field.name, field.label];
            // Enhance search terms (Logic from original worker.ts)
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
                // Fast search
                const element = await page.waitForSelector(selectors, { timeout: 2000 });
                if (element) {
                    await this.safeType(page, element, field.value);
                    fieldFound = true;
                }
            } catch (e) { }
        }

        // Fallback for Message Field (Crucial for generic forms)
        if (!fieldFound) {
            const messageField = fields.find(f => f.name.includes("message") || f.name.includes("comment"));
            if (messageField) {
                fieldFound = await this.tryFallbackFilling(page, messageField.value);
            }
        }

        return fieldFound;
    }

    private async safeType(page: Page, element: ElementHandle, text: string) {
        try {
            await element.click({ clickCount: 3 }); // Select all
            await element.press('Backspace');   // Clear
            await element.type(text, { delay: 5 });

            // React/Vue Event Dispatching
            await page.evaluate((el: any) => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }, element);
        } catch (e) {
            console.warn("[FormEngine] Typing error:", e);
        }
    }

    private async tryFallbackFilling(page: Page, text: string): Promise<boolean> {
        try {
            const fallbackSelector = 'textarea, div[contenteditable="true"]';
            const elements = await page.$$(fallbackSelector);
            for (const el of elements) {
                if (await el.boundingBox()) {
                    // Check emptiness
                    const content = await page.evaluate((e: any) => e.value || e.innerText, el);
                    if (!content || content.length < 5) {
                        await this.safeType(page, el, text);
                        return true;
                    }
                }
            }
        } catch (e) { }
        return false;
    }
}
