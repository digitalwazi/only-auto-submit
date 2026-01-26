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
        echo "=== TOGGLING CAMPAIGN STATUS ===";
        sqlite3 /root/only-auto-submit/prisma/dev.db "UPDATE Campaign SET status='PAUSED' WHERE id='cmktwvqh10000hs9ymujj1n4r';"
        sleep 1;
        sqlite3 /root/only-auto-submit/prisma/dev.db "UPDATE Campaign SET status='RUNNING' WHERE id='cmktwvqh10000hs9ymujj1n4r';"
        
        echo "=== VERIFYING FIELDS JSON ===";
        sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT fields FROM Campaign WHERE id='cmktwvqh10000hs9ymujj1n4r';"
        
        echo "=== RESTARTING WORKER ===";
        pm2 restart worker-daemon;
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
