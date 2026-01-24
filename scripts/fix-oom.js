const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 600000, // 10 mins for build
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    const projectDir = '/root/auto-submitter';
    const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

    const cmd = `
        echo "=== ENABLING SWAP ===";
        fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048;
        chmod 600 /swapfile;
        mkswap /swapfile;
        swapon /swapfile;
        echo "/swapfile none swap sw 0 0" >> /etc/fstab;
        echo "Swap enabled.";
        free -m;
        
        echo "=== BUILDING ===";
        cd ${projectDir};
        ${envSetup};
        npm run build;
        
        echo "=== RESTARTING ===";
        pm2 restart next-app;
        pm2 restart worker-daemon;
        pm2 save;
        pm2 status;
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
