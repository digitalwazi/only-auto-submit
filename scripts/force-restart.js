const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 10000
};

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED');
    const run = (cmd, timeout = 15000) => new Promise((resolve) => {
        console.log(`\n>>> ${cmd}`);
        let output = '';
        const timer = setTimeout(() => {
            console.log('\n[TIMEOUT]');
            resolve(output);
        }, timeout);

        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); clearTimeout(timer); return resolve(); }
            stream.on('data', d => {
                output += d.toString();
                process.stdout.write(d);
            })
                .on('stderr', d => process.stderr.write(d))
                .on('close', () => { clearTimeout(timer); resolve(output); });
        });
    });

    // Kill any zombie processes
    console.log('\n=== KILL ZOMBIE PROCESSES ===');
    await run('pkill -f "node.*next" 2>/dev/null || true', 5000);
    await run('pkill -9 chrome 2>/dev/null || true', 5000);

    // Wait
    await new Promise(r => setTimeout(r, 2000));

    // Restart PM2 with fresh ecosystem
    console.log('\n=== RESTART PM2 ===');
    await run('pm2 kill 2>/dev/null || true', 5000);
    await run('cd /root/auto-submitter && pm2 start ecosystem.config.js', 20000);

    // Wait for startup
    await new Promise(r => setTimeout(r, 8000));

    // Verify
    console.log('\n=== VERIFY ===');
    await run('pm2 list', 10000);
    await run('curl -I http://localhost:3001 2>/dev/null | head -3', 5000);

    conn.end();
}).connect(config);

conn.on('error', (err) => {
    console.error('Connection error:', err.message);
});
