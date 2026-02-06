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
    console.log('CONNECTED - EMERGENCY STOP');
    const cmd = `
        echo "=== KILLING EVERYTHING ==="
        pm2 stop all
        pkill -9 chrome 2>/dev/null || true
        pkill -9 chromium 2>/dev/null || true
        pkill -9 puppeteer 2>/dev/null || true
        
        echo "=== REMOVING TEMP CHROME ==="
        rm -rf /tmp/puppeteer* 2>/dev/null || true
        
        echo "=== PULL LATEST CODE ==="
        cd /root/auto-submitter && git pull
        
        echo "=== REBUILD ==="
        cd /root/auto-submitter && npm run build
        
        echo "=== DELETE PM2 DUMP ==="
        rm -f /root/.pm2/dump.pm2
        
        echo "=== START ONLY MAIN APP (NO WORKER) ==="
        cd /root/auto-submitter && pm2 start npm --name "auto-submitter" -- start
        
        echo "=== DO NOT START BG-WORKER YET ==="
        echo "Worker will be started manually after verification"
        
        echo "=== DONE ==="
        pm2 list
        curl -I http://localhost:3001 2>&1 | head -3
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d))
            .on('stderr', d => process.stderr.write(d))
            .on('close', () => conn.end());
    });
}).on('error', e => console.error('ERROR:', e.message)).connect(config);
