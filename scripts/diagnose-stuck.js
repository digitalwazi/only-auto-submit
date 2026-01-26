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
        echo "=== PM2 STATUS ===";
        pm2 list;
        
        echo "\\n=== WORKER LOGS (LAST 50) ===";
        pm2 logs worker-daemon --lines 50 --nostream;
        
        echo "\\n=== DB LINK STATUS ===";
        sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT status, COUNT(*) FROM Link GROUP BY status;";
        
        echo "\\n=== DB SYSTEM LOGS (LAST 5) ===";
        sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT * FROM SystemLog ORDER BY id DESC LIMIT 5;";
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
