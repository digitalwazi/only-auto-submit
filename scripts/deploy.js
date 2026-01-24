const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    remotePath: '/root/auto-submitter',
    readyTimeout: 60000, // 60 seconds
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
                // console.log(`Stream :: close :: code: ${code}, signal: ${signal}`);
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

async function uploadFile(sftp, localPath, remotePath) {
    return new Promise((resolve, reject) => {
        // console.log(`Uploading ${localPath} to ${remotePath}`);
        sftp.fastPut(localPath, remotePath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function getFiles(dir, fileList = [], rootDir = dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.next' || file === '.git' || file === '.gemini') continue;
            getFiles(filePath, fileList, rootDir);
        } else {
            fileList.push({
                local: filePath,
                relative: path.relative(rootDir, filePath).replace(/\\/g, '/')
            });
        }
    }
    return fileList;
}

conn.on('ready', async () => {
    console.log('Client :: ready');
    try {
        // 1. Check Node & PM2
        console.log('--- Checking Environment ---');
        try {
            await executeCommand(conn, 'node -v');
            await executeCommand(conn, 'pm2 -v');
        } catch (e) {
            console.log('Node or PM2 missing. Installing...');
            await executeCommand(conn, 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash');
            await executeCommand(conn, 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh" && nvm install 20 && nvm use 20 && npm install -g pm2');
        }

        // 2. Prepare Remote Directory
        console.log('--- Preparing Remote Directory ---');
        await executeCommand(conn, `mkdir -p ${config.remotePath}`);

        // 3. Upload Files
        console.log('--- Uploading Files ---');
        conn.sftp(async (err, sftp) => {
            if (err) throw err;

            const files = getFiles(path.join(__dirname, '..'));
            // Create all directories first
            const dirs = new Set(files.map(f => path.dirname(f.relative)));
            for (const dir of dirs) {
                if (dir === '.') continue;
                try {
                    await executeCommand(conn, `mkdir -p "${config.remotePath}/${dir}"`);
                } catch (e) { } // ignore if exists
            }

            // Upload files (sequentially to avoid connection limits, or parallel batches)
            console.log(`Uploading ${files.length} files...`);
            for (const file of files) {
                const remoteFilePath = `${config.remotePath}/${file.relative}`;
                // console.log(`Uploading ${file.relative}`);
                await uploadFile(sftp, file.local, remoteFilePath);
            }

            console.log('--- Installing Dependencies & Building ---');
            // Ensure we use the right node/npm from nvm if needed, or assume global path if installed globally
            // More robust: source nvm before every command group
            const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

            await executeCommand(conn, `${envSetup} && cd ${config.remotePath} && npm install --legacy-peer-deps`);
            await executeCommand(conn, `${envSetup} && cd ${config.remotePath} && npx prisma generate`);
            await executeCommand(conn, `${envSetup} && cd ${config.remotePath} && npm run build`);

            console.log('--- Configuring PM2 ---');
            // Check if app is running, if not start it
            try {
                await executeCommand(conn, `${envSetup} && pm2 describe next-app`);
                await executeCommand(conn, `${envSetup} && pm2 restart next-app`);
            } catch (e) {
                await executeCommand(conn, `${envSetup} && cd ${config.remotePath} && pm2 start npm --name "next-app" -- start`);
            }

            // Check if worker is running, if not start it
            try {
                await executeCommand(conn, `${envSetup} && pm2 describe worker-daemon`);
                await executeCommand(conn, `${envSetup} && pm2 restart worker-daemon`);
            } catch (e) {
                await executeCommand(conn, `${envSetup} && cd ${config.remotePath} && pm2 start npm --name "worker-daemon" -- run worker`);
            }

            await executeCommand(conn, `${envSetup} && pm2 save`);
            await executeCommand(conn, `${envSetup} && pm2 status`);

            console.log('--- Deployment Complete ---');
            conn.end();
        });

    } catch (err) {
        console.error('Deployment failed:', err);
        conn.end();
    }
}).connect(config);
