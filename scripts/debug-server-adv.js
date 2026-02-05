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

    await run('pm2 show auto-submitter');
    await run('ls -la /root/.pm2/logs/');
    console.log('\n--- ERROR LOGS ---');
    await run('tail -n 50 /root/.pm2/logs/auto-submitter-error.log');
    console.log('\n--- OUT LOGS ---');
    await run('tail -n 50 /root/.pm2/logs/auto-submitter-out.log');

    conn.end();
}).connect(config);
