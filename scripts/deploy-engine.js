
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

const files = [
    { local: '../src/lib/engine/types.ts', remote: '/root/auto-submitter/src/lib/engine/types.ts' },
    { local: '../src/lib/engine/BrowserManager.ts', remote: '/root/auto-submitter/src/lib/engine/BrowserManager.ts' },
    { local: '../src/lib/engine/PageScanner.ts', remote: '/root/auto-submitter/src/lib/engine/PageScanner.ts' },
    { local: '../src/lib/engine/FormEngine.ts', remote: '/root/auto-submitter/src/lib/engine/FormEngine.ts' },
    { local: '../src/lib/engine/SubmissionStrategies.ts', remote: '/root/auto-submitter/src/lib/engine/SubmissionStrategies.ts' },
    { local: '../src/lib/engine/Verifier.ts', remote: '/root/auto-submitter/src/lib/engine/Verifier.ts' },
    { local: '../src/lib/worker.ts', remote: '/root/auto-submitter/src/lib/worker.ts' }
];

conn.on('ready', () => {
    console.log('Client :: ready');

    // 1. Create directory using exec (Simple)
    conn.exec('mkdir -p /root/auto-submitter/src/lib/engine', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Mkdir execution closed. Code:', code);
            startUploads();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });

    function startUploads() {
        conn.sftp((err, sftp) => {
            if (err) throw err;
            uploadNext(0, sftp);
        });
    }

    function uploadNext(i, sftp) {
        if (i >= files.length) {
            console.log('All files uploaded. Triggering build...');
            rebuild();
            return;
        }

        const file = files[i];
        const localPath = path.join(__dirname, file.local);

        console.log(`Uploading [${i + 1}/${files.length}] ${file.local}...`);
        sftp.fastPut(localPath, file.remote, (err) => {
            if (err) throw err;
            console.log('Success.');
            uploadNext(i + 1, sftp);
        });
    }

    function rebuild() {
        const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';
        const projectDir = '/root/auto-submitter';

        const cmd = `
            ${envSetup}
            cd ${projectDir}
            echo "=== REBUILDING ==="
            npm run build || exit 1
            echo "=== RESTARTING ==="
            pm2 restart next-app || pm2 start npm --name "next-app" -- start -- -p 3001 -H 0.0.0.0
            pm2 restart worker-daemon || pm2 start npm --name "worker-daemon" -- run worker
            pm2 save
            echo "=== DONE ==="
        `; // Added exit 1 to fail fast

        conn.exec(cmd, (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log('Build stream closed. Code: ' + code);
                conn.end();
            }).on('data', (data) => {
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                process.stderr.write(data);
            });
        });
    }

}).connect(config);
