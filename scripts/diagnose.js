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
    const projectDir = '/root/auto-submitter';
    const cmd = `
        echo "=== MEMORY ==="; free -m;
        echo "=== SWAP ==="; swapon -s;
        echo "=== DIR LIST ==="; ls -la ${projectDir};
        echo "=== .NEXT DIR ==="; ls -la ${projectDir}/.next || echo "No .next dir";
        echo "=== PM2 LOGS ==="; pm2 logs next-app --lines 50 --nostream;
    `;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        });
    });
}).connect(config);
