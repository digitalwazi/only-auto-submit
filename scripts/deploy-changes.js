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

    // 1. Stop PM2
    console.log('\n=== STOPPING PM2 ===');
    await run('pm2 stop auto-submitter 2>/dev/null || true');

    // 2. Pull latest code
    console.log('\n=== PULLING LATEST CODE ===');
    await run('cd /root/auto-submitter && git pull');

    // 3. Push schema changes to DB
    console.log('\n=== PUSHING SCHEMA CHANGES ===');
    await run('cd /root/auto-submitter && npx prisma db push');

    // 4. Rebuild
    console.log('\n=== REBUILDING ===');
    await run('cd /root/auto-submitter && npm run build');

    // 5. Restart PM2
    console.log('\n=== RESTARTING PM2 ===');
    await run('pm2 restart auto-submitter');

    // 6. Verify
    await new Promise(r => setTimeout(r, 5000));
    console.log('\n=== VERIFICATION ===');
    await run('curl -s -X POST http://localhost:3001/api/worker/process');
    await run('pm2 logs auto-submitter --lines 10 --nostream');

    conn.end();
}).connect(config);
