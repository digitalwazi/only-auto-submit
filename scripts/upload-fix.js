const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

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
    conn.sftp((err, sftp) => {
        if (err) throw err;

        const localPath = path.join(__dirname, '../src/lib/worker.ts');
        const remotePath = '/root/auto-submitter/src/lib/worker.ts';

        console.log(`Uploading ${localPath} to ${remotePath}...`);

        sftp.fastPut(localPath, remotePath, (err) => {
            if (err) throw err;
            console.log('Upload successful!');

            // Now rebuild
            const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';
            const projectDir = '/root/auto-submitter';

            const cmd = `
                ${envSetup}
                cd ${projectDir}
                
                echo "=== RE-BUILDING WITH FIX ==="
                npm run build || exit 1
                
                echo "=== RESTARTING SERVICES ==="
                pm2 restart next-app || pm2 start npm --name "next-app" -- start -- -p 3001 -H 0.0.0.0
                pm2 restart worker-daemon || pm2 start npm --name "worker-daemon" -- run worker
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
        });
    });
}).connect(config);
