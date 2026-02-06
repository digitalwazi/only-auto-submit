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
    console.log('CONNECTED - Final Verification');
    const cmd = `
        echo "=== PM2 STATUS ==="
        pm2 list
        
        echo "=== BUILD CHECK ==="
        ls /root/auto-submitter/.next/server 2>/dev/null && echo "BUILD OK" || echo "BUILD MISSING"
        
        echo "=== CURL TEST ==="
        curl -sI http://localhost:3001 | head -3
        
        echo "=== EXTERNAL TEST ==="
        curl -sI http://31.97.188.144 | head -3
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d))
            .on('stderr', d => process.stderr.write(d))
            .on('close', () => conn.end());
    });
}).on('error', e => console.error('ERROR:', e.message)).connect(config);
