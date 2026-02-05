const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 60000,
    debug: (msg) => console.log('DEBUG:', msg)
};

const conn = new Client();

function executeCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let output = '';
            stream.on('close', (code, signal) => {
                if (code === 0) resolve(output);
                else reject(new Error(`Command failed with code ${code}: ${output}`));
            }).on('data', (data) => {
                output += data;
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                output += data;
                process.stderr.write(data);
            });
        });
    });
}

conn.on('ready', async () => {
    console.log('Client :: ready');
    try {
        const repoUrl = 'https://github.com/digitalwazi/only-auto-submit.git';
        const projectDir = '/root/auto-submitter';
        const domain = 'crazydealz.in';
        const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

        console.log('--- Checking & Cleaning Environment ---');
        await executeCommand(conn, 'git --version || (apt-get update && apt-get install -y git)');
        await executeCommand(conn, 'nginx -v || (apt-get update && apt-get install -y nginx)');

        // Stop processes
        try { await executeCommand(conn, `${envSetup} && pm2 stop all`); } catch (e) { }

        // Remove ALL existing data as requested
        console.log('--- Wiping Existing Data ---');
        await executeCommand(conn, `rm -rf ${projectDir}`);
        await executeCommand(conn, `rm -f /root/.env.bak /root/dev.db.bak`);

        console.log('--- Cloning Repository ---');
        await executeCommand(conn, `git clone ${repoUrl} ${projectDir}`);

        console.log('--- Environment Variables ---');
        // Create basic .env if it doesn't exist (assuming the user will fill it or we use defaults)
        await executeCommand(conn, `cd ${projectDir} && cp .env.example .env || echo "DATABASE_URL=\\"file:./dev.db\\"" > .env`);

        console.log('--- Installing & Building ---');
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npm install --legacy-peer-deps`);
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npx prisma generate`);
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npx prisma db push --accept-data-loss`);
        // Use memory optimizations for the build
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && export NODE_OPTIONS="--max-old-space-size=2048" && npm run build`);

        console.log('--- Configuring Nginx ---');
        // Check if Nginx config already exists and has SSL
        const checkNginx = await executeCommand(conn, `grep -i "ssl_certificate" /etc/nginx/sites-available/${domain} || echo "NO_SSL"`);

        if (checkNginx.includes('NO_SSL')) {
            console.log('Creating simple HTTP Nginx config (no SSL found)');
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
            await executeCommand(conn, `echo '${nginxConfig}' > /etc/nginx/sites-available/${domain}`);
            await executeCommand(conn, `ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/`);
            await executeCommand(conn, `rm -f /etc/nginx/sites-enabled/default`);
        } else {
            console.log('SSL config found, ensuring proxy_pass is correct');
            // We'll trust the existing config but ensure it's enabled
            await executeCommand(conn, `ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/`);
        }

        await executeCommand(conn, `nginx -t && systemctl restart nginx`);

        console.log('--- Restarting Application ---');
        const startCmd = `pm2 restart next-app || pm2 start npm --name "next-app" -- start`;
        const workerCmd = `pm2 restart worker-daemon || pm2 start npm --name "worker-daemon" -- run worker`;

        await executeCommand(conn, `${envSetup} && cd ${projectDir} && ${startCmd}`);
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && ${workerCmd}`);

        await executeCommand(conn, `${envSetup} && pm2 save`);
        await executeCommand(conn, `${envSetup} && pm2 status`);

        console.log('--- Deployment Complete ---');
        conn.end();

    } catch (err) {
        console.error('Deployment failed:', err);
        conn.end();
    }
});

conn.connect(config);
