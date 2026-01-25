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
        echo "=== WORKER STATUS (ID 2) ===";
        pm2 status 2;
        
        echo "=== LAST 50 LOG LINES ===";
        pm2 logs 2 --lines 50 --nostream;
        
        echo "=== MEMORY STATS ===";
        free -m;
        
        echo "=== DISK SPACE ===";
        df -h;
        
        echo "=== CHECKING FOR OOM KILLS ===";
        dmesg | grep -i "kill" | tail -n 10 || echo "dmesg command might be restricted or no kills found";
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
