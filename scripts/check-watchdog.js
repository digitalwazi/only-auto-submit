const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 20000
};

const conn = new Client();

conn.on('ready', () => {
    console.log('CONNECTED');
    const cmd = `
        echo "=== PM2 LIST ==="
        pm2 list
        
        echo "=== RECENT LOGS ==="
        tail -20 /root/.pm2/logs/auto-submitter-out.log 2>/dev/null || echo "No logs"
        
        echo "=== ERROR LOGS ==="
        tail -10 /root/.pm2/logs/auto-submitter-error.log 2>/dev/null || echo "No errors"
        
        echo "=== CURL ==="
        curl -sI http://localhost:3001 | head -3
        
        echo "=== MEMORY ==="
        free -h | head -2
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d))
            .on('stderr', d => process.stderr.write(d))
            .on('close', () => conn.end());
    });
}).on('error', e => console.error('ERROR:', e.message)).connect(config);
