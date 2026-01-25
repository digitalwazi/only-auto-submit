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
        echo "=== MEMORY USAGE ===";
        free -m;
        
        echo "=== PM2 STATUS ===";
        pm2 status;
        
        echo "=== LOGS FOR NEW APP ===";
        # Try to find the process for port 3001 (only-auto-submit or similar)
        pm2 logs only-auto-submit-new --lines 20 --nostream;
        pm2 logs only-auto-submit --lines 20 --nostream;
        
        echo "=== CURL LOCAL 3001 ===";
        curl -v http://localhost:3001 || echo "Curl failed";
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
