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
        echo "=== PENDING COUNT ===";
        sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT COUNT(*) FROM Link WHERE status='PENDING';"
        
        echo "=== LINK STATUS SUMMARY ===";
        sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT status, COUNT(*) FROM Link GROUP BY status;"

        echo "=== RECENT LOGS (Timestamped) ===";
        grep -a "Worker" /root/only-auto-submit/logs/worker.log | tail -n 10
        
        echo "=== PM2 STATUS ===";
        pm2 list;
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
