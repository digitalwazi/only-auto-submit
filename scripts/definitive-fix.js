const { Client } = require('ssh2');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const npxPath = '/root/.nvm/versions/node/v20.19.6/bin/npx';
const pm2Path = '/root/.nvm/versions/node/v20.19.6/bin/pm2';
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

    console.log('--- RESETTING DATABASE ENVIRONMENT ---');
    await run(`rm -f ${projectDir}/prisma/dev.db`);
    await run(`cd ${projectDir} && echo 'DATABASE_URL="file:/root/auto-submitter/prisma/dev.db"' > .env`);

    console.log('--- FORCING DB PUSH ---');
    await run(`cd ${projectDir} && export DATABASE_URL="file:/root/auto-submitter/prisma/dev.db" && ${npxPath} prisma db push --accept-data-loss`);

    console.log('--- STARTING SERVICES ON PORT 3000 ---');
    await run(`${pm2Path} delete all || true`);
    await run(`cd ${projectDir} && PORT=3000 ${pm2Path} start npm --name "next-app" -- start`);
    await run(`cd ${projectDir} && ${pm2Path} start npm --name "worker-daemon" -- run worker`);
    await run(`${pm2Path} save`);

    console.log('\n--- VERIFYING ---');
    await run(`${pm2Path} status`);

    conn.end();
}).connect(config);
