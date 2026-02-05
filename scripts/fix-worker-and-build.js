const { Client } = require('ssh2');
const fs = require('fs');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const projectDir = '/root/auto-submitter';
const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

conn.on('ready', () => {
    console.log('CONNECTED');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        // Upload local worker.ts to server
        sftp.fastPut('d:/only auto submit/src/lib/worker.ts', `${projectDir}/src/lib/worker.ts`, async (err) => {
            if (err) throw err;
            console.log('UPLOADED');

            // Now run build
            console.log('CLEANING CACHE AND STARTING BUILD...');
            conn.exec(`rm -rf ${projectDir}/.next && ${envSetup} && cd ${projectDir} && export NODE_OPTIONS="--max-old-space-size=2048" && npm run build`, (err, stream) => {
                if (err) throw err;
                stream.on('data', d => process.stdout.write(d))
                    .on('stderr', d => process.stderr.write(d))
                    .on('close', (code) => {
                        console.log(`BUILD FINISHED WITH CODE ${code}`);
                        conn.end();
                    });
            });
        });
    });
}).connect(config);
