
// Mock environment for testing
process.env.DATABASE_URL = "file:./dev.db";

// Import worker (will fail if imports are broken)
import { processBatch } from "../src/lib/worker";

async function main() {
    console.log("Testing worker import and basic execution...");
    try {
        // This will likely return "IDLE" or "WORKER_OFF" if no campaign is running
        // effectively testing the initial DB connection and settings retrieval
        const result = await processBatch();
        console.log("Result:", result);
    } catch (e) {
        console.error("Test Failed:", e);
        process.exit(1);
    }
}

main();
