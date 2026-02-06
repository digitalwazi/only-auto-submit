const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 20000
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
      restart_delay: 5000,
      max_restarts: 999
    }
  ]
};
`;

const conn = new Client();
console.log('Restoring PM2...');
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

    // 1. Create Ecosystem
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/ecosystem.config.js');
            stream.write(ECOSYSTEM_CONFIG);
            stream.end();
            stream.on('close', () => { sftp.end(); resolve(); });
        });
    });
    console.log('Config updated.');

    // 2. Restart Cleanly
    await run('pm2 delete all');
    await run('pm2 start /root/auto-submitter/ecosystem.config.js');
    await run('pm2 save');

    // 3. Verify
    await new Promise(r => setTimeout(r, 8000));
    await run('pm2 list');
    await run('curl -I http://localhost:3001');

    conn.end();
}).connect(config);
