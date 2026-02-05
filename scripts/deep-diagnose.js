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

    // 1. Check if App Responds Locally (Timeout 5s)
    await run('curl -v --max-time 5 http://127.0.0.1:3001');

    // 2. Check public access from inside (NAT reflection/Loopback)
    await run(`curl -v --max-time 5 http://${config.host}:3001`);

    // 3. Check Port 80 Usage
    await run('netstat -tulnp | grep :80 ');

    // 4. Check iptables specifically
    await run('iptables -S | grep 3001');
    await run('iptables -S | grep INPUT');

    conn.end();
}).connect(config);
