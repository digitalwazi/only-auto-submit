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
        echo "=== 1. PROCESS STATUS ===";
        pm2 list;
        
        echo "=== 2. PORT BINDING ===";
        # Check what interfaces port 3001 is listening on
        netstat -tulnp | grep 3001;
        
        echo "=== 3. LOCAL CURL TEST ===";
        # Try to reach it from inside the server
        curl -I http://127.0.0.1:3001 --connect-timeout 5;
        
        echo "=== 4. FIREWALL STATUS ===";
        ufw status verbose;
        
        echo "=== 5. NEXT-APP LOGS ===";
        pm2 logs next-app --lines 30 --nostream;
        
        echo "=== 6. WORKER LOGS ===";
        pm2 logs worker-daemon --lines 10 --nostream;
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
