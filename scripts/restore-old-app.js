const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 600000,
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
        const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

        console.log('--- Stopping All Processes ---');
        try { await executeCommand(conn, `${envSetup} && pm2 stop all`); } catch (e) { }

        console.log('--- Moving New App (Port 3001) ---');
        // Move current auto-submitter (which is the new app) to /root/only-auto-submit
        // Remove target if exists first
        await executeCommand(conn, `rm -rf /root/only-auto-submit`);
        await executeCommand(conn, `mv /root/auto-submitter /root/only-auto-submit`);

        console.log('--- Restoring Old App (Port 3000) ---');
        // Recycle /root/auto-submitter for the OLD app
        const oldRepo = 'https://github.com/digitalwazi/Auto-submitter.git';
        await executeCommand(conn, `git clone ${oldRepo} /root/auto-submitter`);

        console.log('--- Restoring Data for Old App ---');
        // Restore dev.db.bak if it exists
        // Check if dev.db.bak has significant size? 
        await executeCommand(conn, `[ -f /root/dev.db.bak ] && cp /root/dev.db.bak /root/auto-submitter/dev.db || echo "Backup not found!"`);
        // Restore .env.bak if it exists (assuming it was for the old app)
        await executeCommand(conn, `[ -f /root/.env.bak ] && cp /root/.env.bak /root/auto-submitter/.env || echo "Env backup not found!"`);

        console.log('--- Building Old App ---');
        await executeCommand(conn, `${envSetup} && cd /root/auto-submitter && npm install --legacy-peer-deps && npm run build`);

        console.log('--- Restarting Apps ---');
        // Start Old App (3000)
        // Check package.json start script of old app. likely "next start" (default 3000)
        await executeCommand(conn, `${envSetup} && cd /root/auto-submitter && pm2 delete all`); // Clean slate
        await executeCommand(conn, `${envSetup} && cd /root/auto-submitter && pm2 start npm --name "auto-submitter-old" -- start`);

        // Start New App (3001)
        // It's now in /root/only-auto-submit
        await executeCommand(conn, `${envSetup} && cd /root/only-auto-submit && pm2 start npm --name "only-auto-submit-new" -- start`);
        // And its worker
        await executeCommand(conn, `${envSetup} && cd /root/only-auto-submit && pm2 start npm --name "worker-daemon" -- run worker`);

        await executeCommand(conn, `${envSetup} && pm2 save`);
        await executeCommand(conn, `${envSetup} && pm2 status`);

    } catch (err) {
        console.error('Migration failed:', err);
    }
    conn.end();
});

conn.connect(config);
