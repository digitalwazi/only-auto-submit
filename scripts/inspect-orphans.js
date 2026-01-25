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
        echo "=== PM2 PROCESS LIST ===";
        pm2 jlist | grep -o 'name":"[^"]*","pm_id":[^,]*' | sed 's/name":"//;s/","pm_id":/ : /';
        
        echo "=== INSPECT PROCESS 0 ===";
        pm2 describe 0 | grep -E "name|script|args|cwd";
        
        echo "=== INSPECT PROCESS 80 ===";
        pm2 describe 80 | grep -E "name|script|args|cwd";

        echo "=== INSPECT PROCESS 82 (next-app) ===";
        pm2 describe 82 | grep -E "name|script|args|cwd";
        
        echo "=== CURL TEST 3000 ===";
        curl -v http://localhost:3000 || echo "Curl 3000 failed";
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
