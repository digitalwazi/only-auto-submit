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

    // Quick PM2 status
    console.log('\n=== PM2 STATUS ===');
    await run('pm2 list');

    // Restart all
    console.log('\n=== RESTARTING ALL ===');
    await run('pm2 restart all');

    // Wait
    await new Promise(r => setTimeout(r, 5000));

    // Verify
    console.log('\n=== VERIFY ===');
    await run('pm2 list');
    await run('curl -s http://localhost:3001 | head -c 200');

    conn.end();
}).connect(config);
