/**
 * Background Worker Script - WITH SAFEGUARDS
 * Runs via PM2 independently of browser connections.
 * Polls every 30 seconds (not 5!) to prevent server overload.
 */

const BASE_URL = process.env.WORKER_URL || 'http://localhost:3001';
const POLL_INTERVAL = 30000; // 30 seconds - IMPORTANT: Don't reduce this!
const MAX_CONSECUTIVE_ERRORS = 5;

let consecutiveErrors = 0;

async function pingWorker() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000); // 25 second timeout

        const response = await fetch(`${BASE_URL}/api/worker/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        consecutiveErrors = 0; // Reset on success

        // Log based on status
        const timestamp = new Date().toISOString();
        switch (data.status) {
            case 'OK':
                console.log(`[${timestamp}] ✅ Processed ${data.processed} link(s)`);
                break;
            case 'LOW_MEMORY':
                console.warn(`[${timestamp}] ⚠️ LOW MEMORY - Skipping batch`);
                break;
            case 'CHROME_OVERLOAD':
                console.warn(`[${timestamp}] ⚠️ Too many Chrome processes - Cleaned up`);
                break;
            case 'COOLDOWN':
            case 'LOCKED':
            case 'IDLE':
            case 'WORKER_OFF':
                // Silent - these are normal
                break;
            case 'BROWSER_FAIL':
                console.error(`[${timestamp}] ❌ Browser failed to launch`);
                break;
            default:
                if (data.status !== 'IDLE') {
                    console.log(`[${timestamp}] Status: ${data.status}`);
                }
        }
    } catch (error) {
        consecutiveErrors++;
        console.error(`[BG Worker] Error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error.message);

        // If too many errors, wait longer before retrying
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(`[BG Worker] Too many errors. Waiting 2 minutes before retry...`);
            await new Promise(r => setTimeout(r, 120000)); // 2 minute wait
            consecutiveErrors = 0;
        }
    }
}

async function main() {
    console.log('==========================================');
    console.log('  🚀 Background Worker Started (Safe Mode)');
    console.log(`  📡 Polling: ${BASE_URL}/api/worker/process`);
    console.log(`  ⏱️  Interval: ${POLL_INTERVAL / 1000} seconds`);
    console.log('==========================================');

    // Wait 10 seconds before first ping to let app fully start
    console.log('[BG Worker] Waiting 10s for app to stabilize...');
    await new Promise(r => setTimeout(r, 10000));

    // Initial ping
    await pingWorker();

    // Continuous polling
    setInterval(pingWorker, POLL_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[BG Worker] Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[BG Worker] Terminated');
    process.exit(0);
});

// Handle uncaught errors to prevent crash
process.on('uncaughtException', (err) => {
    console.error('[BG Worker] Uncaught exception:', err.message);
    // Don't exit - let PM2 handle restart if needed
});

process.on('unhandledRejection', (reason) => {
    console.error('[BG Worker] Unhandled rejection:', reason);
});

main();
