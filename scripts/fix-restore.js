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
    // 1. Restore .env from new app (assuming same creds or at least valid DATABASE_URL)
    // 2. Restore DB from 1.5MB file found in only-auto-submit

    const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';
    const projectDir = '/root/auto-submitter';

    const cmd = `
        ${envSetup}
        
        echo "=== ENVIRONMENT ==="
        node -v
        npm -v
        pm2 -v
        
        echo "=== RESTARTING SERVICES ==="
        cd ${projectDir}
        
        pm2 restart next-app || pm2 start npm --name "next-app" -- start
        pm2 restart worker-daemon || pm2 start npm --name "worker-daemon" -- run worker
        
        pm2 save
        
        echo "=== PM2 STATUS ==="
        pm2 list
        
        echo "=== PORT STATUS ==="
        ss -tulnp | grep :300
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
