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

    // Check campaigns via API
    console.log('\n=== GET CAMPAIGNS VIA API ===');
    await run('curl -s http://localhost:3001/api/campaigns | head -500');

    // Check worker status
    console.log('\n=== GET WORKER STATUS ===');
    await run('curl -s http://localhost:3001/api/settings');

    // Check logs
    console.log('\n=== GET SYSTEM LOGS ===');
    await run('curl -s http://localhost:3001/api/logs | head -500');

    // Trigger worker and see response
    console.log('\n=== TRIGGER WORKER ===');
    await run('curl -s -X POST http://localhost:3001/api/worker/process');

    conn.end();
}).connect(config);
