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

    // Check PM2 list
    await run('pm2 list');

    // Check bg-worker logs
    await run('pm2 logs bg-worker --lines 10 --nostream');

    // Check auto-submitter logs
    await run('pm2 logs auto-submitter --lines 5 --nostream');

    conn.end();
}).connect(config);
