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

    // 1. Check system resources (OOM?)
    await run('free -m');
    await run('uptime');

    // 2. Check PM2 status
    await run('pm2 list');
    // Read the *Error* log for the last few lines
    await run('tail -n 50 /root/.pm2/logs/auto-submitter-error.log');
    // Read startup log if it exists from previous attempt
    await run('tail -n 50 /root/auto-submitter/startup.log');

    // 3. Check build status
    await run('ls -la /root/auto-submitter/.next');

    conn.end();
}).connect(config);
