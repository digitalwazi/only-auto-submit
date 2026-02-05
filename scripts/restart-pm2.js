const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

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

    const pm2 = '/usr/bin/pm2';

    await run(`${pm2} delete auto-submitter`);
    // Ensure we are in the right directory when starting
    await run(`cd /root/auto-submitter && ${pm2} start npm --name "auto-submitter" -- start`);
    await run(`${pm2} save`);

    // Check again
    await run(`${pm2} list`);
    // Wait a bit for startup
    await new Promise(r => setTimeout(r, 5000));
    await run('netstat -tulnp | grep 3001 || echo "PORT 3001 NOT FOUND"');
    await run('curl -s http://localhost:3001 | head -n 5');

    conn.end();
}).connect(config);
