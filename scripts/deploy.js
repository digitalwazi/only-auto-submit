const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 60000,
    debug: (msg) => console.log('DEBUG:', msg)
};

const conn = new Client();

function executeCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let output = '';
            stream.on('close', (code, signal) => {
                if (code === 0) resolve(output);
                else reject(new Error(`Command failed with code ${code}: ${output}`));
            }).on('data', (data) => {
                output += data;
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                output += data;
                process.stderr.write(data);
            });
        });
    });
}

conn.on('ready', async () => {
    console.log('Client :: ready');
    try {
        const repoUrl = 'https://github.com/digitalwazi/only-auto-submit.git';
        const projectDir = '/root/auto-submitter';
        const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

        console.log('--- Checking Environment ---');
        await executeCommand(conn, 'git --version || (apt-get update && apt-get install -y git)');

        console.log('--- preparing for Git Migration ---');
        // Stop processes to release file locks
        try { await executeCommand(conn, `${envSetup} && pm2 stop all`); } catch (e) { }

        // Backup critical files (.env, dev.db)
        // Check if they exist first to avoid errors
        await executeCommand(conn, `[ -f ${projectDir}/.env ] && cp ${projectDir}/.env /root/.env.bak || echo "No .env to backup"`);
        await executeCommand(conn, `[ -f ${projectDir}/dev.db ] && cp ${projectDir}/dev.db /root/dev.db.bak || echo "No dev.db to backup"`);

        console.log('--- Cloning Repository ---');
        // Wipe directory and clone
        await executeCommand(conn, `rm -rf ${projectDir}`);
        await executeCommand(conn, `git clone ${repoUrl} ${projectDir}`);

        console.log('--- Restoring Config & Data ---');
        // Restore backups
        await executeCommand(conn, `[ -f /root/.env.bak ] && mv /root/.env.bak ${projectDir}/.env || echo "No .env to restore"`);
        await executeCommand(conn, `[ -f /root/dev.db.bak ] && mv /root/dev.db.bak ${projectDir}/dev.db || echo "No dev.db to restore"`);

        console.log('--- Installing & Building ---');
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npm install --legacy-peer-deps`);
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npx prisma generate`);

        // Push schema to db (preserves data if possible, syncs schema)
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npx prisma db push`);

        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npm run build`);

        console.log('--- Restarting Application ---');
        const startCmd = `pm2 restart next-app || pm2 start npm --name "next-app" -- start`;
        const workerCmd = `pm2 restart worker-daemon || pm2 start npm --name "worker-daemon" -- run worker`;

        await executeCommand(conn, `${envSetup} && cd ${projectDir} && ${startCmd}`);
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && ${workerCmd}`);

        await executeCommand(conn, `${envSetup} && pm2 save`);
        await executeCommand(conn, `${envSetup} && pm2 status`);

        console.log('--- Deployment Complete ---');
        conn.end();

    } catch (err) {
        console.error('Deployment failed:', err);
        conn.end();
    }
});

conn.connect(config);
