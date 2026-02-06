const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 30000
};

const conn = new Client();

conn.on('ready', () => {
    console.log('CONNECTED');
    const cmd = `
        echo "=== UPTIME ==="
        uptime
        
        echo "=== PM2 STATUS ==="
        pm2 list
        
        echo "=== PORT CHECK ==="
        netstat -tlnp | grep 3001 || echo "PORT 3001 NOT LISTENING"
        
        echo "=== CURL ==="
        curl -sI http://localhost:3001 | head -3
        
        echo "=== MEMORY ==="
        free -h
        
        echo "=== RECENT ERRORS ==="
        tail -20 /root/.pm2/logs/auto-submitter-error.log 2>/dev/null || echo "No error log"
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d))
            .on('stderr', d => process.stderr.write(d))
            .on('close', () => conn.end());
    });
}).on('error', e => console.error('ERROR:', e.message)).connect(config);
