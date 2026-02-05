const { Client } = require('ssh2');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';
const projectDir = '/root/auto-submitter';

conn.on('ready', () => {
    console.log('CONNECTED');
    // Run build and capture output to a file, then read the file
    conn.exec(`${envSetup} && cd ${projectDir} && export NODE_OPTIONS="--max-old-space-size=2048" && npm run build > build_log.txt 2>&1 || true; cat ${projectDir}/build_log.txt`, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d))
            .on('stderr', d => process.stderr.write(d))
            .on('close', () => conn.end());
    });
}).connect(config);
