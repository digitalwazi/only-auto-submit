/**
 * Background Worker Script
 * Runs via PM2 independently of browser connections.
 * Continuously polls the worker endpoint every 5 seconds.
 */

const BASE_URL = process.env.WORKER_URL || 'http://localhost:3001';
const POLL_INTERVAL = 5000; // 5 seconds

async function pingWorker() {
    try {
        const response = await fetch(`${BASE_URL}/api/worker/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            console.error(`[BG Worker] HTTP ${response.status}`);
            return;
        }

        const data = await response.json();

        // Only log significant events to avoid spam
        if (data.status !== 'IDLE' && data.status !== 'WORKER_OFF') {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] Worker: ${data.status} (processed: ${data.processed || 0})`);
        }
    } catch (error) {
        console.error(`[BG Worker] Connection failed:`, error.message);
    }
}

async function main() {
    console.log('========================================');
    console.log('  Background Worker Started');
    console.log(`  Polling: ${BASE_URL}/api/worker/process`);
    console.log(`  Interval: ${POLL_INTERVAL}ms`);
    console.log('========================================');

    // Initial ping
    await pingWorker();

    // Continuous polling
    setInterval(pingWorker, POLL_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[BG Worker] Shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[BG Worker] Terminated');
    process.exit(0);
});

main();
