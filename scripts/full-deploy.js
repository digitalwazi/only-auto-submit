const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const PROJECT_DIR = '/root/auto-submitter';
const REPO_URL = 'https://github.com/digitalwazi/only-auto-submit.git'; // Update if different

const conn = new Client();

conn.on('ready', async () => {
    console.log('=== CONNECTED TO SERVER ===');

    const run = (cmd, timeout = 120000) => new Promise((resolve, reject) => {
        console.log(`\n>>> ${cmd}`);
        conn.exec(cmd, { timeout }, (err, stream) => {
            if (err) { console.error(err); return resolve({ code: 1, output: '' }); }
            let output = '';
            stream.on('data', d => {
                process.stdout.write(d);
                output += d.toString();
            });
            stream.on('stderr', d => {
                process.stderr.write(d);
                output += d.toString();
            });
            stream.on('close', code => resolve({ code, output }));
        });
    });

    try {
        // 1. Stop existing PM2 process
        console.log('\n=== STEP 1: Stop PM2 ===');
        await run('pm2 stop auto-submitter || true');

        // 2. Backup and fresh clone
        console.log('\n=== STEP 2: Fresh Clone ===');
        await run(`rm -rf ${PROJECT_DIR}.bak`);
        await run(`mv ${PROJECT_DIR} ${PROJECT_DIR}.bak || true`);
        await run(`git clone ${REPO_URL} ${PROJECT_DIR}`, 180000);

        // 3. Install Dependencies
        console.log('\n=== STEP 3: Install Dependencies ===');
        await run(`cd ${PROJECT_DIR} && npm install --legacy-peer-deps`, 300000);

        // 4. Build
        console.log('\n=== STEP 4: Build Application ===');
        const buildResult = await run(`cd ${PROJECT_DIR} && npm run build`, 300000);
        if (buildResult.code !== 0) {
            console.error('\n!!! BUILD FAILED !!!');
            console.log('Restoring backup...');
            await run(`rm -rf ${PROJECT_DIR} && mv ${PROJECT_DIR}.bak ${PROJECT_DIR}`);
            throw new Error('Build failed - backup restored');
        }

        // 5. Configure PM2 Ecosystem
        console.log('\n=== STEP 5: Configure PM2 ===');
        const ecosystem = `
module.exports = {
  apps : [{
    name   : "auto-submitter",
    script : "npm",
    args   : "start",
    cwd    : "${PROJECT_DIR}",
    env: {
      NODE_ENV: "production"
    }
  }]
}
`;
        await new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err);
                const stream = sftp.createWriteStream(`${PROJECT_DIR}/ecosystem.config.js`);
                stream.write(ecosystem);
                stream.end();
                stream.on('close', () => { sftp.end(); resolve(); });
            });
        });

        // 6. Start with PM2
        console.log('\n=== STEP 6: Start Application ===');
        await run('pm2 delete auto-submitter || true');
        await run(`cd ${PROJECT_DIR} && pm2 start ecosystem.config.js`);
        await run('pm2 save');

        // 7. Verify
        console.log('\n=== STEP 7: Verification ===');
        await new Promise(r => setTimeout(r, 10000)); // Wait for startup
        await run('pm2 list');
        await run('netstat -tulnp | grep :3001');
        await run('curl -I http://localhost:80');

        console.log('\n=== DEPLOYMENT COMPLETE ===');
        console.log('Access your site at: http://31.97.188.144/');

    } catch (e) {
        console.error('Deployment Error:', e.message);
    } finally {
        conn.end();
    }
}).connect(config);
