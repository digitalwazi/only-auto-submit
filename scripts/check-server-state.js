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

    // Check if the backup was restored
    await run('cat /root/auto-submitter/next.config.ts');

    // Check build error log if exists
    await run('cat /root/auto-submitter/build_error.log 2>/dev/null || echo "No log"');

    // Also check if the fresh clone has our changes
    await run('cd /root/auto-submitter && git log -1 --oneline');

    conn.end();
}).connect(config);
