const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 30000,
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    const cmd = `
        echo "=== UPTIME ===";
        uptime;
        
        echo "=== MEMORY ===";
        free -h;
        
        echo "=== PM2 LIST ===";
        pm2 list;
        
        echo "=== PORTS ===";
        netstat -tulnp | grep LISTEN;
        
        echo "=== PM2 LOGS (Last 20 lines) ===";
        pm2 logs --lines 20 --nostream;
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
