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

    // Install Puppeteer/Chromium dependencies on Ubuntu
    console.log('\n=== Installing Chromium Dependencies ===');
    await run('apt-get update');
    await run('apt-get install -y chromium-browser fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 xdg-utils');

    // Set Puppeteer to use the system Chromium
    await run('export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true');

    // Check chromium is installed
    await run('which chromium-browser || which chromium');

    // Restart PM2
    await run('pm2 restart auto-submitter');

    // Wait and test
    await new Promise(r => setTimeout(r, 5000));
    await run('curl -X POST http://localhost:3001/api/worker/process');

    conn.end();
}).connect(config);
