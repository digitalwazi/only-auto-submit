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
    const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';
    const projectDir = '/root/auto-submitter';

    const cmd = `
        ${envSetup}
        cd ${projectDir}
        
        echo "=== RE-BUILDING ==="
        npm run build
        
        echo "=== STARTING SERVICES ==="
        # Stop existing
        pm2 stop next-app || true
        pm2 stop worker-daemon || true
        pm2 delete next-app || true
        pm2 delete worker-daemon || true
        
        # Start fresh
        pm2 start npm --name "next-app" -- start -- -p 3001 -H 0.0.0.0
        pm2 start npm --name "worker-daemon" -- run worker
        
        pm2 save
        
        echo "=== VERIFICATION ==="
        sleep 5
        pm2 list
        ss -tulnp | grep :3001
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
