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
    // Source: /root/auto-submitter/dev.db (The good one, on port 3000)
    // Target: /root/only-auto-submit/dev.db (The new one, on port 3001)

    const cmd = `
        echo "=== CHECKING SIZES BEFORE ===";
        ls -lh /root/auto-submitter/dev.db;
        ls -lh /root/only-auto-submit/dev.db;
        
        echo "=== SYNCING DB TO PORT 3001 ===";
        cp /root/auto-submitter/dev.db /root/only-auto-submit/dev.db;
        # Also copy to prisma dir if exists
        [ -d /root/only-auto-submit/prisma ] && cp /root/auto-submitter/dev.db /root/only-auto-submit/prisma/dev.db;
        
        echo "=== CHECKING SIZES AFTER ===";
        ls -lh /root/only-auto-submit/dev.db;
        
        echo "=== RESTARTING PORT 3001 ===";
        # Determine correct process name
        pm2 restart only-auto-submit-new || pm2 restart only-auto-submit;
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
