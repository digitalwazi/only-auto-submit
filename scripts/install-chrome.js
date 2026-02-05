const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED');
    const run = (cmd, timeout = 300000) => new Promise((resolve) => {
        console.log(`\n>>> ${cmd}`);
        conn.exec(cmd, { timeout }, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // Check what's available
    await run('which chromium-browser chromium google-chrome google-chrome-stable');

    // Install Google Chrome
    console.log('\n=== Installing Google Chrome ===');
    await run('wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb');
    await run('apt-get install -y /tmp/chrome.deb');
    await run('rm /tmp/chrome.deb');

    // Verify
    await run('which google-chrome google-chrome-stable');
    await run('google-chrome --version');

    // Restart PM2
    await run('pm2 restart auto-submitter');

    // Wait and test
    await new Promise(r => setTimeout(r, 5000));
    await run('curl -X POST http://localhost:3001/api/worker/process');

    // Check logs for any errors
    await run('pm2 logs auto-submitter --lines 10 --nostream');

    conn.end();
}).connect(config);
