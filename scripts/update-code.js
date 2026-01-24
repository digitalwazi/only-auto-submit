const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 300000,
};

const conn = new Client();

async function uploadDir(sftp, localDir, remoteDir) {
    const files = fs.readdirSync(localDir);
    // Ensure remote dir exists
    try {
        await new Promise((resolve, reject) => {
            conn.exec(`mkdir -p "${remoteDir}"`, (err, stream) => {
                if (err) reject(err);
                stream.on('close', () => resolve());
            });
        });
    } catch (e) { }

    for (const file of files) {
        const localPath = path.join(localDir, file);
        const remotePath = `${remoteDir}/${file}`;
        const stat = fs.statSync(localPath);
        if (stat.isDirectory()) {
            await uploadDir(sftp, localPath, remotePath);
        } else {
            await new Promise((resolve, reject) => {
                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    }
}

conn.on('ready', () => {
    console.log('Client :: ready');
    conn.sftp(async (err, sftp) => {
        if (err) throw err;

        console.log('Uploading src directory...');
        try {
            await uploadDir(sftp, path.join(__dirname, '../src'), '/root/auto-submitter/src');
            console.log('Upload complete.');

            const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';
            const cmd = `${envSetup} && cd /root/auto-submitter && npm run build && pm2 restart all && pm2 status`;

            console.log('Running build and restart...');
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                    conn.end();
                }).on('data', (data) => {
                    process.stdout.write(data);
                });
            });
        } catch (e) {
            console.error(e);
            conn.end();
        }
    });
}).connect(config);
