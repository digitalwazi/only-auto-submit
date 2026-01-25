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
    const cmd = `
        cd /root/only-auto-submit;
        echo "=== NODE_ENV ===";
        echo $NODE_ENV;
        
        echo "=== TSX CHECK ===";
        ls -l node_modules/.bin/tsx || echo "tsx binary not found";
        ls -l node_modules/tsx || echo "tsx package not found";
        
        echo "=== NPM CONFIG ===";
        npm config get production;
        
        echo "=== WORKER PM2 PROCESS ===";
        pm2 describe worker-daemon | grep "script";
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
