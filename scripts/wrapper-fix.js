const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const startScript = `#!/bin/bash
cd /root/auto-submitter
# Ensure node is in path just in case
export PATH=$PATH:/usr/bin
/usr/bin/npm start -- -p 80 -H 0.0.0.0
`;

const ecosystem = `
module.exports = {
  apps : [{
    name   : "auto-submitter",
    script : "/root/auto-submitter/start.sh",
    cwd    : "/root/auto-submitter",
    env: {
      NODE_ENV: "production",
      PORT: 80
    }
  }]
}
`;

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED');
    const run = (cmd) => new Promise((resolve) => {
        console.log(`\n--- [RUNNING]: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // 1. Write start.sh
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/start.sh', { mode: 0o755 }); // Executable
            stream.write(startScript);
            stream.end();
            stream.on('close', () => {
                console.log('Start script written.');
                sftp.end();
                resolve();
            });
        });
    });

    // 2. Update ecosystem
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/ecosystem.config.js');
            stream.write(ecosystem);
            stream.end();
            stream.on('close', () => {
                console.log('Ecosystem file updated.');
                sftp.end();
                resolve();
            });
        });
    });

    // 3. Restart PM2
    const pm2 = '/usr/bin/pm2';
    await run(`${pm2} delete auto-submitter`);
    await run(`cd /root/auto-submitter && ${pm2} start ecosystem.config.js`);
    await run(`${pm2} save`);

    // 4. Verify
    await new Promise(r => setTimeout(r, 10000));
    await run('netstat -tulnp | grep :80');
    await run('curl -I http://localhost:80');

    conn.end();
}).connect(config);
