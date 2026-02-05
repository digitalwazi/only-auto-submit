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
    script : "/usr/bin/npm",
    args   : "start",
    cwd    : "/root/auto-submitter",
    env: {
      NODE_ENV: "production"
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

    // 1. Read package.json, Modify, Write back
    // Since reading via sftp is async/complex, I'll just use sed to replace 3001 with 80 in package.json
    await run(`sed -i 's/next start -p 3001/next start -p 80/g' /root/auto-submitter/package.json`);
    await run(`cat /root/auto-submitter/package.json | grep "start"`);

    // 2. Update ecosystem (simple)
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
    await new Promise(r => setTimeout(r, 8000));
    await run('netstat -tulnp | grep :80');
    await run('curl -I http://localhost:80');

    conn.end();
}).connect(config);
