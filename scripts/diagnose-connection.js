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

    // 1. Check Port Binding
    await run('ss -tulnp | grep 3001 || echo "SS: Port 3001 NOT FOUND"');
    await run('netstat -tulnp | grep 3001 || echo "NETSTAT: Port 3001 NOT FOUND"');

    // 2. Check Firewall
    await run('ufw status verbose');
    await run('iptables -L INPUT -n --line-numbers | head -n 20');

    // 3. check application status again
    await run('pm2 list');
    await run('pm2 logs auto-submitter --lines 20 --nostream');

    // 4. Try local curl
    await run('curl -v http://localhost:3001');

    conn.end();
}).connect(config);
