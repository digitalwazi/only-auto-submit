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

    // Check current state
    console.log('\n=== CURRENT DATABASE STATE ===');
    await run('cd /root/auto-submitter && sqlite3 -header -column prisma/dev.db "SELECT * FROM Campaign;"');
    await run('cd /root/auto-submitter && sqlite3 -header -column prisma/dev.db "SELECT * FROM Link;"');

    // Check if the campaign ID exists
    console.log('\n=== CAMPAIGN CHECK ===');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT COUNT(*) as campaign_count FROM Campaign;"');
    await run('cd /root/auto-submitter && sqlite3 prisma/dev.db "SELECT COUNT(*) as link_count FROM Link;"');

    conn.end();
}).connect(config);
