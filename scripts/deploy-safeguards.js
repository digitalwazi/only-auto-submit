const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 20000
};

console.log('Deploying safeguards...');
const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED');
    const run = (cmd) => new Promise((resolve) => {
        console.log(`\n>>> ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // 1. Stop everything to free memory for build
    await run('pm2 stop all');
    await run('pkill -9 chrome || true');
    await run('pkill -9 node || true');

    // 2. Pull & Build
    await run('cd /root/auto-submitter && git pull');
    await run('cd /root/auto-submitter && npm run build');

    // 3. Restart with fresh memory
    await run('pm2 start ecosystem.config.js');
    await run('pm2 save');

    // 4. Verify
    await new Promise(r => setTimeout(r, 5000));
    await run('pm2 list');
    await run('free -h');

    conn.end();
}).connect(config);
