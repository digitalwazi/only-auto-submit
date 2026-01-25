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
        
        echo "=== WORKER LOGS (worker-daemon) ===";
        # Check logs for the new worker (ID 81 usually, or name worker-daemon)
        pm2 logs worker-daemon --lines 50 --nostream;
        
        echo "=== WORKER ENV CHECK ===";
        # Check DATABASE_URL for the worker process
        pm2 env worker-daemon | grep DATABASE_URL;
        
        echo "=== CAMPAIGN STATUS CHECK ===";
        # Check if any campaigns are in RUNNING state
        sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT id, status, updatedAt FROM Campaign WHERE status='RUNNING' LIMIT 5;";
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
