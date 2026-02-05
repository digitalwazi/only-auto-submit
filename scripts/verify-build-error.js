const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 60000,
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';
    const projectDir = '/root/auto-submitter';

    const cmd = `
        ${envSetup}
        cd ${projectDir}
        
        echo "=== BUILDING WITH LOG CAPTURE ==="
        npm run build > build_output.log 2>&1
        BUILD_EXIT=$?
        
        echo "=== BUILD EXIT CODE: $BUILD_EXIT ==="
        
        if [ $BUILD_EXIT -ne 0 ]; then
            echo "=== ERROR LOGS ==="
            cat build_output.log | tail -n 50
        else
            echo "=== BUILD SUCCESS ==="
        fi
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
