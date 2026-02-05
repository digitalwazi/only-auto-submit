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

    // Stop PM2 to free resources
    conn.exec('/usr/bin/pm2 stop auto-submitter', () => { });

    console.log(`\n--- [RUNNING]: Build & Log ---`);
    conn.exec('cd /root/auto-submitter && npm run build > build_error.log 2>&1', (err, stream) => {
        if (err) { console.error(err); return conn.end(); }

        stream.on('close', (code) => {
            console.log(`\n--- BUILD FINISHED CODE ${code} ---`);
            console.log('--- READING LOG ---');
            conn.exec('cat /root/auto-submitter/build_error.log', (e, s2) => {
                s2.on('data', d => process.stdout.write(d));
                s2.on('close', () => conn.end());
            });
        });
    });
}).connect(config);
