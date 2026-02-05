const { Client } = require('ssh2');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const projectDir = '/root/auto-submitter';
const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

async function run(cmd) {
    return new Promise((resolve) => {
        console.log(`\n--- [RUNNING]: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });
}

conn.on('ready', async () => {
    console.log('CONNECTED');
    await run('node -v');
    await run('npm -v');
    await run(`${envSetup} && node -v`);
    await run(`${envSetup} && npm -v`);
    await run(`${envSetup} && cd ${projectDir} && npx prisma -v`);
    conn.end();
}).connect(config);
