const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 30000
};

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED - Deploying Chrome fix\n');
    const run = (cmd) => new Promise((resolve) => {
        console.log(`>>> ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // 1. Pull latest code
    await run('cd /root/auto-submitter && git pull');

    // 2. Rebuild
    await run('cd /root/auto-submitter && npm run build');

    // 3. Restart PM2
    await run('pm2 restart all');

    // 4. Wait and verify
    await new Promise(r => setTimeout(r, 5000));
    await run('pm2 list');
    await run('curl -I http://localhost:3001 2>&1 | head -5');

    conn.end();
}).connect(config);
