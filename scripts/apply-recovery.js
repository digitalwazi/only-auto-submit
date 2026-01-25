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
    // Source: /root/only-auto-submit/prisma/dev.db (1.5MB)
    // Target: /root/auto-submitter/dev.db (40KB) - Replace this

    // We should copy it to both root and prisma/ just in case, or check env
    const cmd = `
        echo "=== RESTORING DATA TO PORT 3000 ===";
        cp /root/only-auto-submit/prisma/dev.db /root/auto-submitter/dev.db;
        cp /root/only-auto-submit/prisma/dev.db /root/auto-submitter/prisma/dev.db;
        
        echo "=== RESTARTING PORT 3000 APP ===";
        pm2 restart auto-submitter-old;
        pm2 restart only-auto-submit;
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
