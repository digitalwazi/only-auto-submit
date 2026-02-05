const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const ecosystem = `
module.exports = {
  apps : [{
    name   : "auto-submitter",
    script : "npm",
    args   : "start",
    cwd    : "/root/auto-submitter",
    env: {
      NODE_ENV: "production",
      PORT: 3001
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

    // 1. Write ecosystem file
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/ecosystem.config.js');
            stream.write(ecosystem);
            stream.end();
            stream.on('close', () => {
                console.log('Ecosystem file written.');
                sftp.end();
                resolve();
            });
        });
    });

    // 2. Configure Firewall (allow 3001)
    await run('ufw allow 3001/tcp');
    await run('ufw reload');
    await run('ufw status verbose');

    // 3. Start PM2 with ecosystem
    const pm2 = '/usr/bin/pm2';
    await run(`${pm2} delete auto-submitter`);
    await run(`cd /root/auto-submitter && ${pm2} start ecosystem.config.js`);
    await run(`${pm2} save`);

    // 4. Verify
    await new Promise(r => setTimeout(r, 5000));
    await run('netstat -tulnp | grep 3001');
    await run('curl -I http://localhost:3001');

    conn.end();
}).connect(config);
