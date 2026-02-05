const { Client } = require('ssh2');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const pm2Path = '/root/.nvm/versions/node/v20.19.6/bin/pm2';
const npmPath = '/root/.nvm/versions/node/v20.19.6/bin/npm';
const projectDir = '/root/auto-submitter';

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

    await run(`cd ${projectDir} && ${pm2Path} start ${npmPath} --name "next-app" -- start`);
    await run(`cd ${projectDir} && ${pm2Path} start ${npmPath} --name "worker-daemon" -- run worker`);
    await run(`${pm2Path} save`);
    await run(`${pm2Path} status`);

    conn.end();
}).connect(config);
