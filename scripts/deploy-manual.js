const { Client } = require('ssh2');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';
const projectDir = '/root/auto-submitter';
const domain = 'crazydealz.in';

async function run(cmd) {
    return new Promise((resolve, reject) => {
        console.log(`\n--- [RUNNING]: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let output = '';
            stream.on('data', d => {
                output += d;
                process.stdout.write(d);
            }).on('stderr', d => {
                output += d;
                process.stderr.write(d);
            }).on('close', (code) => {
                if (code === 0) resolve(output);
                else reject(new Error(`Exit code ${code}`));
            });
        });
    });
}

conn.on('ready', async () => {
    console.log('CONNECTED');
    try {
        await run('git --version');
        await run(`${envSetup} && pm2 stop all || echo "PM2 not running or no apps"`);

        console.log('--- Cleaning ---');
        await run(`rm -rf ${projectDir}`);
        await run(`git clone https://github.com/digitalwazi/only-auto-submit.git ${projectDir}`);

        console.log('--- Config ---');
        await run(`cd ${projectDir} && cp .env.example .env || echo "DATABASE_URL=\\"file:./dev.db\\"" > .env`);

        console.log('--- Deps ---');
        await run(`${envSetup} && cd ${projectDir} && npm install --legacy-peer-deps`);

        console.log('--- Prisma ---');
        await run(`${envSetup} && cd ${projectDir} && npx prisma generate`);
        await run(`${envSetup} && cd ${projectDir} && npx prisma db push --accept-data-loss`);

        console.log('--- Build (Memory Optimized) ---');
        await run(`${envSetup} && cd ${projectDir} && export NODE_OPTIONS="--max-old-space-size=2048" && npm run build`);

        console.log('--- Nginx ---');
        const hasSSL = await run(`grep -i "ssl_certificate" /etc/nginx/sites-available/${domain} || echo "NO_SSL"`).then(out => !out.includes('NO_SSL'));
        if (!hasSSL) {
            const nginxConfig = `server { listen 80; server_name ${domain} www.${domain}; location / { proxy_pass http://localhost:3001; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection 'upgrade'; proxy_set_header Host $host; proxy_cache_bypass $http_upgrade; } }`;
            await run(`echo '${nginxConfig}' > /etc/nginx/sites-available/${domain}`);
        }
        await run(`ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/`);
        await run(`nginx -t && systemctl restart nginx`);

        console.log('--- PM2 Start ---');
        await run(`${envSetup} && cd ${projectDir} && pm2 restart next-app || pm2 start npm --name "next-app" -- start`);
        await run(`${envSetup} && cd ${projectDir} && pm2 restart worker-daemon || pm2 start npm --name "worker-daemon" -- run worker`);
        await run(`${envSetup} && pm2 save`);

        console.log('\nDeployment Complete!');
    } catch (e) {
        console.error('\nDeployment Failed:', e.message);
    } finally {
        conn.end();
    }
}).connect(config);
