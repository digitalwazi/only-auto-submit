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
        console.log(`\n--- [RUNNING]: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    await run('ls -l /usr/bin/node');
    await run('ls -l /usr/bin/npm');
    await run('/usr/bin/npm config get prefix');

    // Try to run pm2 via npx? No, too slow.
    // Try to locate pm2 again with find but better
    await run('find /usr -name pm2 -type f -executable 2>/dev/null');

    conn.end();
}).connect(config);
