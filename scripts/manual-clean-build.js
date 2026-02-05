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

    // Stop PM2 to prevent interference
    await new Promise(r => conn.exec('/usr/bin/pm2 delete auto-submitter', (err, stream) => {
        if (stream) stream.on('close', r); else r();
    }));

    // Manual Build & Start Sequence
    console.log('\n--- MANUAL CLEAN & BUILD & START ---');
    const cmd = `
        cd /root/auto-submitter && 
        rm -rf .next && 
        npm run build && 
        npm start -- -p 3001
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) { console.error(err); return conn.end(); }

        stream.on('data', d => process.stdout.write(d));
        stream.on('stderr', d => process.stderr.write(d));

        // Let it run for 60 seconds (build takes time) then we check if it's listening
        setTimeout(() => {
            console.log('\n--- CHECKING PORT ---');
            conn.exec('netstat -tulnp | grep :3001', (err, s2) => {
                s2.on('data', d => process.stdout.write(d));
                s2.on('close', () => {
                    conn.end();
                });
            });
        }, 60000);
    });
}).connect(config);
