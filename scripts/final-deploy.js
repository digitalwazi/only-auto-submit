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
const remoteProjectDir = '/root/auto-submitter';
const domain = 'crazydealz.in';

const conn = new Client();

const nodePath = '/root/.nvm/versions/node/v20.19.6/bin/node';
const npmPath = '/root/.nvm/versions/node/v20.19.6/bin/npm';
const npxPath = '/root/.nvm/versions/node/v20.19.6/bin/npx';
const pm2Path = '/root/.nvm/versions/node/v20.19.6/bin/pm2';

function executeCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        console.log(`\n--- [RUNNING]: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let output = '';
            stream.on('data', (data) => {
                output += data;
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                output += data;
                process.stderr.write(data);
            }).on('close', (code, signal) => {
                if (code === 0) resolve(output);
                else if (code !== null) reject(new Error(`Exit code ${code}`));
                else reject(new Error(`Terminated by signal ${signal}`));
            });
        });
    });
}

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

conn.on('ready', async () => {
    console.log('CONNECTED TO SERVER');
    try {
        console.log('--- Phase 0: System Check ---');
        await executeCommand(conn, 'df -h && free -m');

        console.log('--- Phase 1: Cleanup & Clone ---');
        const cleanupAndClone = [
            `${pm2Path} delete all || true`,
            `rm -rf ${remoteProjectDir}`,
            `git clone --depth 1 https://github.com/digitalwazi/only-auto-submit.git ${remoteProjectDir}`
        ].join(' && ');
        await executeCommand(conn, cleanupAndClone);

        console.log('--- Phase 2: Modular File Sync ---');
        const sftp = await new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) reject(err);
                else resolve(sftp);
            });
        });

        await uploadDir(sftp, path.join(localProjectDir, 'src/lib/engine'), `${remoteProjectDir}/src/lib/engine`);
        await new Promise((resolve, reject) => {
            sftp.fastPut(path.join(localProjectDir, 'src/lib/worker.ts'), `${remoteProjectDir}/src/lib/worker.ts`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Files synced.');

        console.log('--- Phase 3: Setup & Build ---');
        const setupAndBuild = [
            `cd ${remoteProjectDir}`,
            `echo "DATABASE_URL=\\"file:./dev.db\\"" > .env`,
            `${npmPath} install --legacy-peer-deps`,
            `${npxPath} prisma generate`,
            `${npxPath} prisma db push --accept-data-loss`,
            `export NODE_OPTIONS="--max-old-space-size=2048"`,
            `${npmPath} run build`
        ].join(' && ');
        await executeCommand(conn, setupAndBuild);

        console.log('--- Phase 4: Nginx ---');
        const nginxConfig = `
server {
    listen 80;
    server_name ${domain} www.${domain};
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
        await executeCommand(conn, `echo '${nginxConfig}' > /etc/nginx/sites-available/${domain} && ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/ && nginx -t && systemctl restart nginx`);

        console.log('--- Phase 5: Launch ---');
        const launchCmd = [
            `cd ${remoteProjectDir}`,
            `${pm2Path} start ${npmPath} --name "next-app" -- start`,
            `${pm2Path} start ${npmPath} --name "worker-daemon" -- run worker`,
            `${pm2Path} save`
        ].join(' && ');
        await executeCommand(conn, launchCmd);

        console.log('\n✅ DEPLOYMENT COMPLETE!');
        console.log(`App live at: http://${domain}`);
        conn.end();

    } catch (err) {
        console.error('\n❌ DEPLOYMENT FAILED:', err.message);
        conn.end();
    }
});

conn.connect(config);
