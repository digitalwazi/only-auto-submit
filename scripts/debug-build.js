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
        
        echo "=== CHECKING .NEXT ==="
        ls -F .next/
        
        echo "=== CHECKING BUILD ID ==="
        cat .next/BUILD_ID || echo "No BUILD_ID"
        
        echo "=== MANUAL START ATTEMPT ==="
        # Try running next start directly for 5 seconds to see if it errors immediately
        timeout 5s npx next start -p 3001 -H 0.0.0.0 || echo "Manual start finished (or timeout)"
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
