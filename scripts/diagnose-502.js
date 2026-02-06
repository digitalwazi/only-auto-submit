const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 30000
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

    // Check PM2 status
    console.log('\n=== PM2 LIST ===');
    await run('pm2 list');

    // Check recent logs for auto-submitter
    console.log('\n=== APP LOGS (Error) ===');
    await run('tail -n 30 /root/.pm2/logs/auto-submitter-error.log');

    console.log('\n=== APP LOGS (Out) ===');
    await run('tail -n 30 /root/.pm2/logs/auto-submitter-out.log');

    // Check if port 3001 is listening
    console.log('\n=== PORTS ===');
    await run('netstat -tlnp | grep 3001');

    // Check Nginx status
    console.log('\n=== NGINX STATUS ===');
    await run('systemctl status nginx | head -n 10');

    // Check Memory
    console.log('\n=== MEMORY ===');
    await run('free -h');

    conn.end();
}).connect(config);
