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

    // 1. Check Nginx Error Log
    await run('tail -n 20 /var/log/nginx/error.log');

    // 2. Check Local Curl (Force IPv4)
    await run('curl -v http://127.0.0.1:3001');

    // 3. Check Local Curl (Hostname)
    await run('curl -v http://localhost:3001');

    conn.end();
}).connect(config);
