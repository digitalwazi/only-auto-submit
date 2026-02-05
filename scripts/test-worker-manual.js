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

    // Reset the first campaign to RUNNING and add a test link
    console.log('\n=== ADDING TEST DATA ===');

    // Get campaign ID first
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT id FROM Campaign LIMIT 1;"');

    // Insert a test link manually
    await run(`cd /root/auto-submitter && sqlite3 prisma/dev.db "INSERT INTO Link (id, url, status, campaignId, createdAt, updatedAt) VALUES ('test-link-1', 'https://example.com', 'PENDING', 'cml9ut4l70000rbhhquiivo6w', datetime('now'), datetime('now'));"`);

    // Update campaign to RUNNING
    await run(`cd /root/auto-submitter && sqlite3 prisma/dev.db "UPDATE Campaign SET status='RUNNING' WHERE id='cml9ut4l70000rbhhquiivo6w';"`);

    // Verify
    console.log('\n=== VERIFY ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT * FROM Link;"');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT id, name, status FROM Campaign;"');

    // Trigger worker
    console.log('\n=== TRIGGER WORKER ===');
    await run('curl -X POST http://localhost:3001/api/worker/process');

    // Check logs
    await new Promise(r => setTimeout(r, 5000));
    await run('pm2 logs auto-submitter --lines 15 --nostream');

    conn.end();
}).connect(config);
