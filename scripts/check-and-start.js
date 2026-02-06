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
        
        echo "=== BUILD EXISTS? ==="
        ls /root/auto-submitter/.next/server 2>/dev/null && echo "BUILD OK" || echo "NO BUILD"
        
        echo "=== IS BUILD RUNNING? ==="
        ps aux | grep "next build" | grep -v grep || echo "Build not running"
        
        echo "=== START APP IF NOT RUNNING ==="
        pm2 list | grep -q "online" && echo "Already running" || (cd /root/auto-submitter && pm2 start npm --name "auto-submitter" -- start && echo "Started app")
        
        echo "=== WAIT ==="
        sleep 3
        
        echo "=== FINAL PM2 LIST ==="
        pm2 list
        
        echo "=== CURL TEST ==="
        curl -sI http://localhost:3001 | head -3
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d))
            .on('stderr', d => process.stderr.write(d))
            .on('close', () => conn.end());
    });
}).on('error', e => console.error('ERROR:', e.message)).connect(config);
