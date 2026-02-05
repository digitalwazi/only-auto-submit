const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const ENV_CONTENT = `DATABASE_URL="file:./dev.db"
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

    // 1. Create .env file
    console.log('\n=== Creating .env ===');
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/.env');
            stream.write(ENV_CONTENT);
            stream.end();
            stream.on('close', () => {
                console.log('.env created!');
                sftp.end();
                resolve();
            });
        });
    });

    // 2. Run Prisma db push
    console.log('\n=== Running Prisma db push ===');
    await run('cd /root/auto-submitter && npx prisma db push');

    // 3. Restart PM2
    console.log('\n=== Restarting App ===');
    await run('pm2 restart auto-submitter');

    // 4. Verify
    await new Promise(r => setTimeout(r, 5000));
    await run('curl -I http://localhost:80');

    conn.end();
}).connect(config);
