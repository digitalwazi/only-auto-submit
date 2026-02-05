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

    // Find all .db files
    console.log('\n=== FIND DATABASE FILES ===');
    await run('find /root/auto-submitter -name "*.db" -type f 2>/dev/null');

    // Check .env file content
    console.log('\n=== CHECK ENV FILE ===');
    await run('cat /root/auto-submitter/.env');

    // Check db location from prisma
    console.log('\n=== CHECK PRISMA FOLDER ===');
    await run('ls -la /root/auto-submitter/prisma/');

    // Try using the full path
    console.log('\n=== FULL PATH QUERY ===');
    await run('sqlite3 /root/auto-submitter/prisma/dev.db "SELECT * FROM Campaign;" 2>&1');

    conn.end();
}).connect(config);
