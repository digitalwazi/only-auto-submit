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
    const run = (cmd) => new Promise((resolve) => {
        console.log(`\n>>> ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // Check recent PM2 logs for worker activity
    await run('pm2 logs auto-submitter --lines 30 --nostream');

    // Try to trigger the worker endpoint
    await run('curl -X POST http://localhost:3001/api/worker/process');

    // Check database for campaigns
    await run('cd /root/auto-submitter && npx prisma db execute --file=/dev/stdin <<< "SELECT id, name, status FROM Campaign LIMIT 5;"');

    conn.end();
}).connect(config);
