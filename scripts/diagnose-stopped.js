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

    // Check PM2 status
    console.log('\n=== PM2 STATUS ===');
    await run('pm2 list');

    // Check bg-worker logs
    console.log('\n=== BG-WORKER LOGS ===');
    await run('pm2 logs bg-worker --lines 20 --nostream');

    // Check auto-submitter logs
    console.log('\n=== AUTO-SUBMITTER LOGS ===');
    await run('pm2 logs auto-submitter --lines 20 --nostream');

    // Check if processes are running
    console.log('\n=== PROCESS CHECK ===');
    await run('ps aux | grep -E "(node|next)" | head -10');

    // Check port 3001
    console.log('\n=== PORT CHECK ===');
    await run('netstat -tlnp | grep 3001');

    conn.end();
}).connect(config);
