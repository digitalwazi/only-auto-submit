const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 60000,
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    // 1. Restore .env from new app (assuming same creds or at least valid DATABASE_URL)
    // 2. Restore DB from 1.5MB file found in only-auto-submit

    const cmd = `
        echo "=== FIXING ENV ===";
        cp /root/only-auto-submit/.env /root/auto-submitter/.env;
        
        echo "=== RESTORING DB (AGAIN) ===";
        # Force overwrite
        cp -f /root/only-auto-submit/prisma/dev.db /root/auto-submitter/dev.db;
        cp -f /root/only-auto-submit/prisma/dev.db /root/auto-submitter/prisma/dev.db;
        
        echo "=== VERIFYING SIZE ===";
        ls -lh /root/auto-submitter/dev.db;
        
        echo "=== RESTARTING ===";
        pm2 restart auto-submitter-old;
        pm2 status;
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
