const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 600000,
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    const projectDir = '/root/auto-submitter';
    const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

    const cmd = `
        cd ${projectDir};
        ${envSetup};
        echo "=== NEXT VERSION ==="; npx next --version;
        echo "=== BUILDING ===";
        mkdir -p .next;
        npm run build > build.log 2>&1;
        echo "=== BUILD LOG ===";
        cat build.log;
        echo "=== LIST .NEXT ===";
        ls -la .next;
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
