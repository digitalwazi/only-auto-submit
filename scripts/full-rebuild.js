const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 60000,
    keepaliveInterval: 10000
};

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED - Full rebuild\n');
    const run = (cmd) => new Promise((resolve) => {
        console.log(`>>> ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // 1. Stop bg-worker to prevent Chrome loops
    await run('pm2 stop bg-worker');

    // 2. Full rebuild
    console.log('\n--- REBUILDING ---');
    await run('cd /root/auto-submitter && npm run build');

    // 3. Restart all
    console.log('\n--- RESTARTING PM2 ---');
    await run('pm2 restart all');

    // 4. Wait and verify
    await new Promise(r => setTimeout(r, 8000));
    await run('pm2 list');
    await run('curl -I http://localhost:3001 2>&1 | head -5');

    conn.end();
}).connect(config);
