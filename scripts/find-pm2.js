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

    await run('echo $PATH');
    await run('find / -name pm2 2>/dev/null | head -n 5');
    await run('find / -name npm 2>/dev/null | head -n 5');
    await run('ls -la /usr/local/bin');
    await run('ls -la /usr/bin/pm2');

    conn.end();
}).connect(config);
