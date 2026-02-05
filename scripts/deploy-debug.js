const { Client } = require('ssh2');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const projectDir = '/root/auto-submitter';

conn.on('ready', async () => {
    console.log('CONNECTED');

    const run = (cmd) => new Promise((resolve) => {
        console.log(`\n--- [RUNNING]: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    await run(`ls -la ${projectDir}/src/lib/worker.ts`);
    await run(`wc -l ${projectDir}/src/lib/worker.ts`);
    await run(`grep -rn "captchaSelectors" ${projectDir}/src --exclude-dir=node_modules || echo "NOT FOUND"`);
    await run(`grep -rn "document.querySelector" ${projectDir}/src --exclude-dir=node_modules || echo "NOT FOUND"`);

    conn.end();
}).connect(config);
