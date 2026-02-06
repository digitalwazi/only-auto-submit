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
        echo "=== STOP WORKER ==="
        pm2 stop bg-worker 2>/dev/null || true
        pkill -9 chrome 2>/dev/null || true
        
        echo "=== CHROME CHECK ==="
        which google-chrome 2>/dev/null || echo "google-chrome: NOT FOUND"
        which chromium-browser 2>/dev/null || echo "chromium-browser: NOT FOUND"
        google-chrome --version 2>/dev/null || echo "google-chrome version: FAILED"
        
        echo "=== PUPPETEER CACHE ==="
        ls -la /root/.cache/puppeteer/ 2>/dev/null || echo "No puppeteer cache"
        
        echo "=== PM2 STATUS ==="
        pm2 list
        
        echo "=== MEMORY ==="
        free -h
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d))
            .on('stderr', d => process.stderr.write(d))
            .on('close', () => conn.end());
    });
}).on('error', e => console.error('ERROR:', e.message)).connect(config);
