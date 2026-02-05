const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const localProjectDir = 'd:/only auto submit';
const conn = new Client();

async function uploadDir(sftp, localDir, remoteDir) {
    if (!fs.existsSync(localDir)) return;
    await new Promise((resolve) => sftp.mkdir(remoteDir, { recursive: true }, () => resolve()));
    const files = fs.readdirSync(localDir);
    for (const file of files) {
        const localPath = path.join(localDir, file);
        const remotePath = path.join(remoteDir, file).replace(/\\/g, '/');
        if (fs.statSync(localPath).isDirectory()) {
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

function executeCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        console.log(`\n--- [RUNNING]: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', (code) => {
                    if (code === 0) resolve();
                    else if (code !== null) reject(new Error(`Exit code ${code}`));
                    else resolve(); // In bomb-proof mode, we might just lose connection
                });
        });
    });
}

conn.on('ready', () => {
    console.log('CONNECTED');
    conn.sftp(async (err, sftp) => {
        if (err) throw err;
        try {
            console.log('--- Phase 1: Uploading Deployment Artifacts ---');
            await new Promise((resolve, reject) => {
                sftp.mkdir('/root/deploy_temp', { recursive: true }, () => resolve());
            });

            process.stdout.write('Uploading remote-deploy.sh... ');
            await new Promise((resolve, reject) => {
                sftp.fastPut(path.join(localProjectDir, 'scripts/remote-deploy.sh'), '/root/remote-deploy.sh', (err) => {
                    if (err) { console.error(err); reject(err); }
                    else { console.log('OK'); resolve(); }
                });
            });

            console.log('Uploading modular engine folder... ');
            await uploadDir(sftp, path.join(localProjectDir, 'src/lib/engine'), '/root/deploy_temp/engine');

            console.log('Uploading worker.ts... ');
            await new Promise((resolve, reject) => {
                sftp.fastPut(path.join(localProjectDir, 'src/lib/worker.ts'), '/root/deploy_temp/worker.ts', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log('\n--- Phase 2: Executing Remote Deployment ---');
            console.log('This will keep running even if we disconnect.');
            await executeCommand(conn, 'bash /root/remote-deploy.sh');

            console.log('\n✅ Script execution finished (or connection dropped but script is running).');
            console.log('Monitor results at: http://crazydealz.in');
            conn.end();

        } catch (e) {
            console.error('FAILED:', e.message);
            conn.end();
        }
    });
}).connect(config);
