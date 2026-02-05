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

    // Check all campaigns
    console.log('\n=== CAMPAIGNS ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT id, name, status FROM Campaign;"');

    // Check links count per status
    console.log('\n=== LINKS BY STATUS ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT status, COUNT(*) FROM Link GROUP BY status;"');

    // Check if there are PENDING links
    console.log('\n=== PENDING LINKS ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT id, url, status FROM Link WHERE status=\'PENDING\' LIMIT 5;"');

    // Check worker settings
    console.log('\n=== GLOBAL SETTINGS ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT * FROM GlobalSettings;"');

    // Get recent PM2 logs
    console.log('\n=== RECENT LOGS ===');
    await run('pm2 logs auto-submitter --lines 20 --nostream');

    // Manually trigger worker to see what happens
    console.log('\n=== TRIGGER WORKER ===');
    await run('curl -X POST http://localhost:3001/api/worker/process');

    conn.end();
}).connect(config);
