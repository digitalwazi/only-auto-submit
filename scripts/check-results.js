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

    // Check ALL links with their status and results
    console.log('\n=== ALL LINKS ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT id, url, status, error FROM Link;"');

    // Check campaign details
    console.log('\n=== CAMPAIGN DETAILS ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT * FROM Campaign;"');

    // Initialize GlobalSettings if missing
    console.log('\n=== INIT GLOBAL SETTINGS ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "INSERT OR IGNORE INTO GlobalSettings (id, concurrency, isWorkerOn, autoRestartInterval, headless) VALUES (1, 1, 1, 0, 1);"');

    // Verify settings
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT * FROM GlobalSettings;"');

    // Check system logs
    console.log('\n=== SYSTEM LOGS ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT id, message, type, createdAt FROM SystemLog ORDER BY id DESC LIMIT 10;"');

    conn.end();
}).connect(config);
