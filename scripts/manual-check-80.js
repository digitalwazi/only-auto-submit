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

    // Stop PM2 first
    await new Promise(r => conn.exec('/usr/bin/pm2 stop auto-submitter', (err, stream) => {
        stream.on('close', r);
    }));

    console.log(`\n--- [RUNNING]: npm start (manual) ---`);
    conn.exec('cd /root/auto-submitter && npm start', (err, stream) => {
        if (err) { console.error(err); return conn.end(); }

        stream.on('data', d => process.stdout.write(d));
        stream.on('stderr', d => process.stderr.write(d));

        // After 5 seconds, check netstat in a SEPARATE channel/exec
        setTimeout(() => {
            conn.exec('netstat -tulnp | grep :80', (err, stream2) => {
                console.log('\n--- [NETSTAT CHECK] ---');
                stream2.on('data', d => process.stdout.write(d));
                stream2.on('close', () => {
                    console.log('--- [END NETSTAT] ---');
                    conn.end(); // checking done, close main connection (killing npm start)
                });
            });
        }, 8000);
    });
}).connect(config);
