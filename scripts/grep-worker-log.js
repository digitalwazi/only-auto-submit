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
    // Search for the new log signatures we added
    const cmd = `
        echo "=== WORKER ERROR LOGS (Last 50) ===";
        tail -n 50 /root/.pm2/logs/worker-daemon-error.log;
        
        echo "=== WORKER OUT LOGS (Last 50) ===";
        tail -n 50 /root/.pm2/logs/worker-daemon-out.log;
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
