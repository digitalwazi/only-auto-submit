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
    const cmd = `
        echo "=== ALL DB FILES ===";
        find /root -name "*.db" -ls;
        echo "=== ALL SQLITE FILES ===";
        find /root -name "*.sqlite*" -ls;
        echo "=== .ENV CHECK ===";
        cat /root/auto-submitter/.env || echo "No .env";
        echo "=== SCHEMA CHECK ===";
        cat /root/auto-submitter/prisma/schema.prisma || echo "No schema";
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
