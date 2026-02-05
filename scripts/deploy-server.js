const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const repoUrl = 'https://github.com/digitalwazi/only-auto-submit.git';
const projectDir = '/root/auto-submitter';

const conn = new Client();

conn.on('ready', async () => {
    console.log('Client :: ready');

    const execCommand = (cmd, cwd = projectDir, ignoreError = false) => {
        return new Promise((resolve, reject) => {
            console.log(`\n> Executing: ${cmd}`);
            conn.exec(`cd ${cwd} && ${cmd}`, (err, stream) => {
                if (err) return reject(err);

                let output = '';
                stream.on('close', (code, signal) => {
                    console.log(`> Command '${cmd}' exited with code ${code}`);
                    if (code !== 0 && !ignoreError) {
                        reject(new Error(`Command failed with code ${code}`));
                    } else {
                        resolve(output);
                    }
                }).on('data', (data) => {
                    process.stdout.write(data);
                    output += data;
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        });
    };

    try {
        // 0. Check and Install Node.js
        console.log('Step 0: Checking Node.js...');
        try {
            await execCommand('node -v', '/root');
        } catch (e) {
            console.log('Node.js not found. Installing...');
            await execCommand('curl -fsSL https://deb.nodesource.com/setup_20.x -o nodesource_setup.sh', '/root');
            await execCommand('bash nodesource_setup.sh', '/root');
            await execCommand('apt-get install -y nodejs', '/root');
            console.log('Node.js installed.');
        }

        // 1. Prepare directory
        console.log('Step 1: Preparing directory...');
        await execCommand(`mkdir -p ${projectDir}`, '/root');

        // 2. Clone or Pull
        console.log('Step 2: Syncing repository...');
        try {
            await execCommand('git status', projectDir);
            console.log('Repo exists, pulling...');
            await execCommand('git pull');
        } catch (e) {
            console.log('Repo not found or invalid, cloning via HTTPS...');
            // Ensure dir is empty-ish or just clone into .
            // If git status failed, it might contain some files but not .git
            // We'll try cloning into . 
            await execCommand(`git clone ${repoUrl} .`);
        }

        // 3. Install Dependencies
        console.log('Step 3: Installing dependencies...');
        await execCommand('npm install --legacy-peer-deps');

        // 4. Build
        console.log('Step 4: Building application...');
        await execCommand('npm run build');

        // 5. PM2 Setup
        console.log('Step 5: Configuring PM2...');
        try {
            await execCommand('pm2 --version', '/root'); // run in root to avoid cwd issues
        } catch (e) {
            console.log('Installing PM2 globally...');
            await execCommand('npm install -g pm2');
        }

        // Start/Restart
        try {
            await execCommand('pm2 describe auto-submitter', '/root');
            console.log('Restarting existing PM2 process...');
            await execCommand('pm2 restart auto-submitter');
        } catch (e) {
            console.log('Starting new PM2 process...');
            await execCommand('pm2 start npm --name "auto-submitter" -- start');
        }

        await execCommand('pm2 save');

        // Final verification output
        await execCommand('pm2 list');
        await execCommand('netstat -tulnp | grep 3001 || echo "Port 3001 check failed (might just need time)"');

        console.log('DEPLOYMENT SUCCESSFUL!');

    } catch (err) {
        console.error('DEPLOYMENT FAILED:', err);
    } finally {
        conn.end();
    }

}).connect(config);
