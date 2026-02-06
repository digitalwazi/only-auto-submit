const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 20000
};

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED - Stopping worker and checking Chrome\n');
    const run = (cmd) => new Promise((resolve) => {
        console.log(`>>> ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // 1. STOP THE WORKER LOOP IMMEDIATELY
    await run('pm2 stop bg-worker');
    await run('pkill -9 chrome 2>/dev/null || true');
    await run('pkill -9 chromium 2>/dev/null || true');

    // 2. Check if Chrome/Chromium is installed
    console.log('\n--- CHROME CHECK ---');
    await run('which google-chrome || which chromium-browser || which chromium || echo "NO CHROME FOUND"');
    await run('google-chrome --version 2>/dev/null || chromium-browser --version 2>/dev/null || chromium --version 2>/dev/null || echo "VERSION CHECK FAILED"');

    // 3. Check Puppeteer's bundled Chrome
    await run('ls -la /root/auto-submitter/node_modules/puppeteer/.local-chromium/ 2>/dev/null || echo "No bundled chromium"');
    await run('ls -la /root/.cache/puppeteer/ 2>/dev/null || echo "No cache puppeteer"');

    // 4. Check system libraries for Chrome
    console.log('\n--- MISSING LIBS CHECK ---');
    await run('ldd /root/.cache/puppeteer/chrome/*/chrome-linux64/chrome 2>/dev/null | grep "not found" | head -10 || echo "Lib check done"');

    // 5. Current memory after stopping
    console.log('\n--- CURRENT STATE ---');
    await run('free -h');
    await run('pm2 list');

    conn.end();
}).connect(config);
