const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 20000
};

console.log('Debugging start...');
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

    // Stop PM2 to release port
    await run('pm2 stop all');

    // Try manual start and capture output (timeout after 10s)
    console.log('\n=== MANUAL START ===');
    conn.exec('cd /root/auto-submitter && npm run start', (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.on('stderr', d => process.stderr.write(d));

        // Kill after 15 seconds
        setTimeout(() => {
            console.log('\n[TIMEOUT] Killing process...');
            conn.exec('pkill -f "next-server"', () => {
                conn.end();
            });
        }, 15000);
    });

}).connect(config);
