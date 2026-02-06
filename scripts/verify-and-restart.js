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
        echo "=== CHECK BUILD ==="
        ls -la /root/auto-submitter/.next/standalone 2>/dev/null && echo "BUILD EXISTS" || echo "NO BUILD"
        
        echo "=== RESTART PM2 ==="
        pm2 restart all
        
        echo "=== WAIT 5s ==="
        sleep 5
        
        echo "=== PM2 STATUS ==="
        pm2 list
        
        echo "=== CURL TEST ==="
        curl -I http://localhost:3001 2>&1 | head -5
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d))
            .on('stderr', d => process.stderr.write(d))
            .on('close', () => conn.end());
    });
}).on('error', e => console.error('ERROR:', e.message)).connect(config);
