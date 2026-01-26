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
        echo "=== STOPPING WORKER ===";
        pm2 stop worker-daemon;

        echo "=== SYNCING DB SCHEMA ===";
        cd /root/only-auto-submit;
        npx prisma db push;
        
        echo "=== GENERATING CLIENT ===";
        npx prisma generate;
        
        echo "=== VERIFYING COLUMNS ===";
        sqlite3 prisma/dev.db 'PRAGMA table_info(Link);' | grep -E "submittedUrl|screenshotPath";
        
        echo "=== RESTARTING WORKER ===";
        pm2 restart worker-daemon;
        
        echo "=== DONE ===";
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
