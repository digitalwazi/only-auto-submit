const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const ECOSYSTEM_CONFIG = `
module.exports = {
  apps: [
    {
      name: 'auto-submitter',
      cwd: '/root/auto-submitter',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      restart_delay: 5000,
      max_restarts: 10
    },
    {
      name: 'bg-worker',
      cwd: '/root/auto-submitter',
      script: 'scripts/background-worker.js',
      interpreter: 'node',
      env: {
        WORKER_URL: 'http://localhost:3001'
      },
      restart_delay: 3000,
      max_restarts: 999,
      autorestart: true
    }
  ]
};
`;

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED');
    const run = (cmd) => new Promise((resolve) => {
        console.log(`\n>>> ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // 1. Stop all PM2 processes
    console.log('\n=== STOPPING ALL PM2 ===');
    await run('pm2 stop all 2>/dev/null || true');

    // 2. Pull latest code
    console.log('\n=== PULLING LATEST CODE ===');
    await run('cd /root/auto-submitter && git pull');

    // 3. Create new ecosystem config
    console.log('\n=== CREATING ECOSYSTEM CONFIG ===');
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/ecosystem.config.js');
            stream.write(ECOSYSTEM_CONFIG);
            stream.end();
            stream.on('close', () => { sftp.end(); resolve(); });
        });
    });
    console.log('Ecosystem config created!');

    // 4. Delete all PM2 processes and start fresh
    console.log('\n=== RESTARTING WITH NEW ECOSYSTEM ===');
    await run('pm2 delete all 2>/dev/null || true');
    await run('cd /root/auto-submitter && pm2 start ecosystem.config.js');
    await run('pm2 save');

    // 5. Verify both processes running
    await new Promise(r => setTimeout(r, 5000));
    console.log('\n=== VERIFICATION ===');
    await run('pm2 list');
    await run('pm2 logs bg-worker --lines 5 --nostream');

    conn.end();
}).connect(config);
