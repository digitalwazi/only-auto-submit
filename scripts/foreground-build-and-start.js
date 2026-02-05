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

    // Stop PM2
    conn.exec('/usr/bin/pm2 stop auto-submitter', () => { });

    console.log(`\n--- [RUNNING]: Clean Rebuild & Start ---`);
    const cmd = 'cd /root/auto-submitter && rm -rf .next && npm run build && echo "BUILD SUCCESS" && npm start';

    conn.exec(cmd, (err, stream) => {
        if (err) { console.error(err); return conn.end(); }

        let output = '';
        stream.on('data', d => {
            process.stdout.write(d);
            output += d.toString();
        });
        stream.on('stderr', d => {
            process.stderr.write(d);
            output += d.toString();
        });

        stream.on('close', (code) => {
            console.log(`\n--- EXITED WITH CODE ${code} ---`);
            conn.end();
        });
    });
}).connect(config);
