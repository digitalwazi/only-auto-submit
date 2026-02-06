const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 30000,
    keepaliveInterval: 10000
};

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED - Deploying safeguards\n');
    const run = (cmd) => new Promise((resolve) => {
        console.log(`>>> ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // 1. Stop everything first
    await run('pm2 stop all 2>/dev/null || true');
    await run('pkill -9 chrome 2>/dev/null || true');
    await run('rm -rf /tmp/puppeteer* 2>/dev/null || true');

    // 2. Pull latest code
    await run('cd /root/auto-submitter && git pull');

    // 3. Rebuild
    console.log('\n--- Building (this takes ~7 min) ---');
    await run('cd /root/auto-submitter && npm run build');

    // 4. Delete PM2 dump to prevent old config restore
    await run('rm -f /root/.pm2/dump.pm2');

    // 5. Start with ecosystem config (includes bg-worker now)
    const ecosystemConfig = `
module.exports = {
    apps: [
        {
            name: "auto-submitter",
            cwd: "/root/auto-submitter",
            script: "npm",
            args: "start",
            env: {
                NODE_ENV: "production",
                PORT: "3001"
            },
            max_restarts: 10,
            restart_delay: 5000
        },
        {
            name: "bg-worker",
            cwd: "/root/auto-submitter",
            script: "scripts/background-worker.js",
            env: {
                WORKER_URL: "http://localhost:3001"
            },
            max_restarts: 10,
            restart_delay: 10000
        }
    ]
};
`;

    // Write ecosystem config
    await run(`cat > /root/auto-submitter/ecosystem.config.js << 'EOF'
${ecosystemConfig}
EOF`);

    // Start with ecosystem
    await run('cd /root/auto-submitter && pm2 start ecosystem.config.js');
    await run('pm2 save');

    // Wait and verify
    await new Promise(r => setTimeout(r, 8000));
    await run('pm2 list');
    await run('curl -sI http://localhost:3001 | head -3');

    console.log('\n=== DEPLOYMENT COMPLETE ===');
    conn.end();
}).connect(config);
