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
        echo "=== PULLING CHANGES ===";
        cd /root/only-auto-submit;
        git pull;
        
        echo "=== REBUILDING NEXT.JS (FOR UI UPDATES) ===";
        # This might take a bit.
        npm run build;
        
        echo "=== RESTARTING ALL PROCESSES ===";
        # Restart worker (ID 2) and App (Likely named 'next' or 'auto-submitter' - checking list first)
        pm2 restart 2; 
        # Attempt to restart valid nextjs process.
        # If 'auto-submitter-old' (0) is old, we might need to find the new one.
        # Assuming ID 0 is actually the active one or there is another one.
        # Let's just restart all for safety.
        pm2 restart all;
        
        echo "=== VERIFYING WORKER LOGS ===";
        sleep 5;
        pm2 logs worker-daemon --lines 20 --nostream;
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
