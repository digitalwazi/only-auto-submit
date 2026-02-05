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

    // Check system status
    console.log('\n=== SYSTEM STATUS ===');
    await run('free -h');
    await run('uptime');

    // Start PM2 with ecosystem
    console.log('\n=== STARTING PM2 ===');
    await run('cd /root/auto-submitter && pm2 start ecosystem.config.js');
    await run('pm2 save');

    // Wait for startup
    await new Promise(r => setTimeout(r, 8000));

    // Verify
    console.log('\n=== VERIFICATION ===');
    await run('pm2 list');
    await run('curl -I http://localhost:3001 2>/dev/null | head -5');

    conn.end();
}).connect(config);

conn.on('error', (err) => {
    console.error('Connection error:', err.message);
});
