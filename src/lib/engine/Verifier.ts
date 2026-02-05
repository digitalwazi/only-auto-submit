
import { Page } from 'puppeteer';
import { EngineResult } from './types';
import fs from 'fs';
import path from 'path';

export class Verifier {

    async verify(page: Page, beforeUrl: string, beforeContent: string, linkId: string): Promise<EngineResult> {
        try {
            const afterContent = await page.content();
            const afterUrl = page.url();
            const lowerContent = afterContent.toLowerCase();

            // 1. FAIL FAST: Strict Error Keywords
            const errorKeywords = [
                "captcha", "error: ", "submission failed", "could not be sent",
                "invalid field", "access denied", "access blocked",
                "request blocked", "security block", "firewall block",
                "you have been blocked", "forbidden", "duplicate comment"
            ];

            const foundError = errorKeywords.find(k => lowerContent.includes(k));
            if (foundError) {
                if (foundError.includes("duplicate")) {
                    return await this.packageResult(page, linkId, 'SUCCESS', "Duplicate Comment (Already Submitted)");
                }
                return await this.packageResult(page, linkId, 'FAILED', `Found error keyword: ${foundError}`);
            }

            // 2. CHECK SUCCESS: Strict Success Keywords
            const successKeywords = [
                "comment awaiting moderation", "your comment is awaiting moderation",
                "thank you for your comment", "thanks for your comment",
                "comment submitted", "successfully posted", "comment was added",
                "pending approval", "message sent", "message has been sent"
            ];

            const foundSuccess = successKeywords.find(k => lowerContent.includes(k));
            if (foundSuccess) {
                return await this.packageResult(page, linkId, 'SUCCESS', `Found keyword: "${foundSuccess}"`);
            }

            // 3. CHECK REDIRECT (Strict)
            if (beforeUrl !== afterUrl) {
                // If URL changed and NO error keywords found -> Assume Success
                return await this.packageResult(page, linkId, 'SUCCESS', "URL Changed (Redirected, no errors)");
            }

            // 4. CHECK CONTENT CHANGE (Weakest check)
            if (beforeContent === afterContent) {
                return await this.packageResult(page, linkId, 'FAILED', "Content unchanged after submit");
            }

            // 5. AMBIGUOUS STATE
            // Content changed, URL same, No Success keyword, No Error keyword.
            // This is the "False Positive" danger zone.
            // Given the user's strictness, we should probably FAIL or WARN manually.
            return await this.packageResult(page, linkId, 'FAILED', "Ambiguous: Content changed but no success message found (Strict Mode)");

        } catch (e: any) {
            return { status: 'FAILED', reason: `Verification Crash: ${e.message}` };
        }
    }

    private async packageResult(page: Page, linkId: string, status: 'SUCCESS' | 'FAILED' | 'WARN', reason: string): Promise<EngineResult> {
        let screenshotPath = undefined;
        let dbScreenshotPath = undefined;

        // Capture Evidence for EVERYTHING now to be safe, or at least Success/Fail
        // User wants proof for Failures.
        // We will capture for ALL final states to be safe.
        try {
            const screenshotDir = path.join(process.cwd(), 'public', 'screenshots');
            if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

            const prefix = status === 'SUCCESS' ? 'proof' : 'fail';
            const filename = `${prefix}-${linkId}-${Date.now()}.webp`;

            await page.screenshot({ path: path.join(screenshotDir, filename), type: 'webp', quality: 50 });
            dbScreenshotPath = `/screenshots/${filename}`;
        } catch (e) {
            console.error("[Verifier] Screenshot failed:", e);
        }

        return {
            status,
            reason,
            screenshotPath: dbScreenshotPath,
            submittedUrl: page.url()
        };
    }
}
