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

    // Check App responsiveness locally
    console.log('\n=== CURL LOCALHOST:3001 ===');
    await run('curl -v http://localhost:3001/ 2>&1 | head -n 20');

    // Check PM2 details (uptime/restarts)
    console.log('\n=== PM2 DETAILS ===');
    await run('pm2 list');

    // Check Nginx Error Log
    console.log('\n=== NGINX ERROR LOG ===');
    await run('tail -n 20 /var/log/nginx/error.log');

    conn.end();
}).connect(config);
