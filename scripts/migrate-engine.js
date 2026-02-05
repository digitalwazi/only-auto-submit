const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const localProjectDir = 'd:/only auto submit';
const remoteProjectDir = '/root/auto-submitter';
const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

async function uploadDir(sftp, localDir, remoteDir) {
    if (!fs.existsSync(localDir)) return;

    // Ensure remote dir exists
    await new Promise((resolve) => sftp.mkdir(remoteDir, (err) => resolve()));

    const files = fs.readdirSync(localDir);
    for (const file of files) {
        const localPath = path.join(localDir, file);
        const remotePath = path.join(remoteDir, file).replace(/\\/g, '/');

        if (fs.statSync(localPath).isDirectory()) {
            await uploadDir(sftp, localPath, remotePath);
        } else {
            process.stdout.write(`Uploading ${file}... `);
            await new Promise((resolve, reject) => {
                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) { console.error(err); reject(err); }
                    else { console.log('OK'); resolve(); }
                });
            });
        }
    }
}

conn.on('ready', () => {
    console.log('CONNECTED');
    conn.sftp(async (err, sftp) => {
        if (err) throw err;
        try {
            console.log('--- UPLOADING ENGINE ---');
            await uploadDir(sftp, path.join(localProjectDir, 'src/lib/engine'), `${remoteProjectDir}/src/lib/engine`);

            console.log('--- UPLOADING WORKER ---');
            await new Promise((resolve, reject) => {
                sftp.fastPut(path.join(localProjectDir, 'src/lib/worker.ts'), `${remoteProjectDir}/src/lib/worker.ts`, (err) => {
                    if (err) reject(err);
                    else { console.log('worker.ts OK'); resolve(); }
                });
            });

            console.log('--- STARTING CLEAN BUILD ---');
            const buildCmd = `${envSetup} && cd ${remoteProjectDir} && rm -rf .next && export NODE_OPTIONS="--max-old-space-size=2048" && npm run build`;
            conn.exec(buildCmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', d => process.stdout.write(d))
                    .on('stderr', d => process.stderr.write(d))
                    .on('close', (code) => {
                        console.log(`BUILD EXIT CODE: ${code}`);
                        conn.end();
                    });
            });

        } catch (e) {
            console.error('Migration failed:', e);
            conn.end();
        }
    });
}).connect(config);
