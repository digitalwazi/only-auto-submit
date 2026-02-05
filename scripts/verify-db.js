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

    // Get full database state
    console.log('\n=== DATABASE TABLES ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db ".tables"');

    // Count rows in each table
    console.log('\n=== ROW COUNTS ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT \'Campaign\', COUNT(*) FROM Campaign UNION SELECT \'Link\', COUNT(*) FROM Link UNION SELECT \'GlobalSettings\', COUNT(*) FROM GlobalSettings UNION SELECT \'SystemLog\', COUNT(*) FROM SystemLog;"');

    // Show all campaign data
    console.log('\n=== ALL CAMPAIGNS ===');
    await run('cd /root/auto-submitter && sqlite3 -header -column prisma/dev.db "SELECT id, name, status FROM Campaign;"');

    conn.end();
}).connect(config);
