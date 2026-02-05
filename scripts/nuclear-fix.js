const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const startScript = `#!/bin/bash
cd /root/auto-submitter
export NODE_ENV=production
export PATH=$PATH:/usr/bin

echo "Starting build..." > /root/auto-submitter/startup.log
/usr/bin/npm run build >> /root/auto-submitter/startup.log 2>&1

echo "Starting app..." >> /root/auto-submitter/startup.log
# Run next directly
./node_modules/.bin/next start -p 3001 -H 0.0.0.0 >> /root/auto-submitter/startup.log 2>&1
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

    // 1. Write start-app.sh
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/start-app.sh', { mode: 0o755 });
            stream.write(startScript);
            stream.end();
            stream.on('close', () => {
                console.log('Start script written.');
                sftp.end();
                resolve();
            });
        });
    });

    // 2. Restart PM2 (ecosystem already points to start-app.sh)
    const pm2 = '/usr/bin/pm2';
    await run(`${pm2} delete auto-submitter`);
    await run(`${pm2} start /root/auto-submitter/ecosystem.config.js`); // Ensure using file
    await run(`${pm2} save`);

    // 3. Monitor startup log
    console.log('\n--- MONITORING STARTUP LOG ---');
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        await run('tail -n 5 /root/auto-submitter/startup.log');
        // Check netstat too
        await run('netstat -tulnp | grep :3001');
    }

    conn.end();
}).connect(config);
