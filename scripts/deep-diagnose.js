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
        pm2 status;
        
        echo "=== WORKER LOGS (LAST 50) ===";
        tail -n 50 /root/.pm2/logs/worker-daemon-out.log;
        tail -n 50 /root/.pm2/logs/worker-daemon-error.log;
        
        echo "=== PROCESS CHECK (CHROME/NODE) ===";
        ps aux | grep -E "node|chrome|puppeteer" | grep -v grep | head -n 20;
        
        echo "=== MEMORY USAGE ===";
        free -m;
        
        echo "=== DB STUCK JOBS CHECK ===";
        sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT count(*) FROM Link WHERE status='PROCESSING';";
        sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT id, url, status, updatedAt FROM Link WHERE status='PROCESSING' ORDER BY updatedAt ASC LIMIT 5;";
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
