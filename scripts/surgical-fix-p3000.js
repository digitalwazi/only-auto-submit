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
const nodePath = '/root/.nvm/versions/node/v20.19.6/bin/node';
const npmPath = '/root/.nvm/versions/node/v20.19.6/bin/npm';
const npxPath = '/root/.nvm/versions/node/v20.19.6/bin/npx';
const pm2Path = '/root/.nvm/versions/node/v20.19.6/bin/pm2';

const conn = new Client();

function run(cmd) {
    return new Promise((resolve, reject) => {
        console.log(`\n--- [RUNNING]: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Exit code ${code}`));
                });
        });
    });
}

conn.on('ready', async () => {
    console.log('CONNECTED - STARTING PORT 3000 DEPLOY');
    try {
        // 1. Force Stop & Cleanup
        try { await run(`${pm2Path} delete all || true`); } catch (e) { }

        // 2. Upload correct schema
        const sftp = await new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) reject(err);
                else resolve(sftp);
            });
        });
        await new Promise((resolve, reject) => {
            sftp.fastPut(path.join(localProjectDir, 'prisma/schema.prisma'), `${remoteProjectDir}/prisma/schema.prisma`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Schema uploaded.');

        // 3. Ensure Database Path in .env is ABSOLUTE
        await run(`cd ${remoteProjectDir} && echo "DATABASE_URL=\\"file:/root/auto-submitter/prisma/dev.db\\"" > .env`);

        // 4. Re-Generate Prisma
        await run(`cd ${remoteProjectDir} && export DATABASE_URL="file:/root/auto-submitter/prisma/dev.db" && ${npxPath} prisma generate`);
        await run(`cd ${remoteProjectDir} && export DATABASE_URL="file:/root/auto-submitter/prisma/dev.db" && ${npxPath} prisma db push --accept-data-loss`);

        // 5. Update Nginx to Port 3000
        const nginxConfig = `
server {
    listen 80;
    server_name ${domain} www.${domain};
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
        await run(`echo '${nginxConfig}' > /etc/nginx/sites-available/${domain}`);
        await run(`nginx -t && systemctl restart nginx`);

        // 6. Start on Port 3000
        console.log('--- STARTING ON PORT 3000 ---');
        await run(`cd ${remoteProjectDir} && PORT=3000 ${pm2Path} start ${npmPath} --name "next-app" -- start`);
        await run(`cd ${remoteProjectDir} && ${pm2Path} start ${npmPath} --name "worker-daemon" -- run worker`);
        await run(`${pm2Path} save`);

        console.log('\n✅ PORT 3000 DEPLOYMENT FINISHED');
        conn.end();
    } catch (e) {
        console.error('FAILED:', e.message);
        conn.end();
    }
});

conn.connect(config);
