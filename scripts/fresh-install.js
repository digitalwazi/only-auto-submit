const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 60000,
};

const conn = new Client();

function executeCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        console.log(`\n>>> Running: ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let output = '';
            stream.on('close', (code, signal) => {
                console.log(`<<< Finished with code ${code}`);
                if (code === 0) resolve(output);
                else reject(new Error(`Command failed with code ${code}`));
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
        // Source NVM to ensure node/npm/pm2 are available
        const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

        console.log('--- 1. STOPPING & CLEANING PROCESSES ---');
        // Ignore errors if processes don't exist
        try { await executeCommand(conn, `${envSetup} && pm2 delete next-app`); } catch (e) { }
        try { await executeCommand(conn, `${envSetup} && pm2 delete worker-daemon`); } catch (e) { }

        // Ensure port 3001 is free
        try { await executeCommand(conn, `fuser -k 3001/tcp`); } catch (e) { }

        console.log('--- 2. BACKING UP DATA ---');
        // Check check for existence before copy
        await executeCommand(conn, `[ -f ${projectDir}/.env ] && cp ${projectDir}/.env /root/.env.bak || echo "No .env to backup"`);
        await executeCommand(conn, `[ -f ${projectDir}/dev.db ] && cp ${projectDir}/dev.db /root/dev.db.bak || echo "No dev.db to backup"`);
        // Also try to find it in the other folder mentioned in history just in case
        await executeCommand(conn, `[ -f /root/only-auto-submit/prisma/dev.db ] && cp /root/only-auto-submit/prisma/dev.db /root/dev.db.bak.alt || echo "No alt db backup"`);

        console.log('--- 3. WIPING & CLONING ---');
        await executeCommand(conn, `rm -rf ${projectDir}`);
        await executeCommand(conn, `git clone ${repoUrl} ${projectDir}`);

        console.log('--- 4. RESTORING CONFIG ---');
        // Restore .env
        await executeCommand(conn, `[ -f /root/.env.bak ] && cp /root/.env.bak ${projectDir}/.env || echo "WARNING: No .env found to restore!"`);
        // Restore DB - Prefer the one from the project dir if it existed, otherwise fallback
        await executeCommand(conn, `[ -f /root/dev.db.bak ] && cp /root/dev.db.bak ${projectDir}/prisma/dev.db || cp /root/dev.db.bak.alt ${projectDir}/prisma/dev.db || echo "WARNING: No database found to restore!"`);

        console.log('--- 5. INSTALLING & BUILDING ---');
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npm install --legacy-peer-deps`);
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npx prisma generate`);
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npx prisma db push`);
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && npm run build`);

        console.log('--- 6. STARTING WITH PM2 ---');
        // Explicit start command on port 3001
        const startCmd = `pm2 start npm --name "next-app" -- start -- -p 3001 -H 0.0.0.0`;
        const workerCmd = `pm2 start npm --name "worker-daemon" -- run worker`;

        await executeCommand(conn, `${envSetup} && cd ${projectDir} && ${startCmd}`);
        await executeCommand(conn, `${envSetup} && cd ${projectDir} && ${workerCmd}`);

        await executeCommand(conn, `${envSetup} && pm2 save`);

        console.log('--- 7. VERIFICATION ---');
        await executeCommand(conn, `${envSetup} && pm2 list`);
        await executeCommand(conn, `${envSetup} && sleep 5 && ss -tulnp | grep :3001`);

        console.log('--- FRESH INSTALL COMPLETE ---');
        conn.end();

    } catch (err) {
        console.error('Failed:', err);
        conn.end();
    }
});

conn.connect(config);
