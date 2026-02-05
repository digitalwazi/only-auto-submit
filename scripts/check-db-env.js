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

    // Check if .env exists
    await run('ls -la /root/auto-submitter/.env 2>/dev/null || echo ".env NOT FOUND"');

    // Check Prisma schema for datasource
    await run('cat /root/auto-submitter/prisma/schema.prisma | head -20');

    // Check if SQLite database file exists (if using SQLite)
    await run('ls -la /root/auto-submitter/prisma/*.db 2>/dev/null || echo "No .db files found"');

    conn.end();
}).connect(config);
