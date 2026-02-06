const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 20000
};

console.log('Connecting...');
const conn = new Client();

conn.on('ready', () => {
    console.log('CONNECTED');
    // Chained commands to ensure execution even if one fails
    const cmd = `
        echo "=== STOPPING PM2 ===";
        pm2 stop all;
        
        echo "=== KILLING CHROME ===";
        pkill -9 chrome || true;
        pkill -9 chromium || true;
        
        echo "=== KILLING NODE ===";
        pkill -9 node || true;
        pkill -9 npm || true;
        
        echo "=== CHECKING LOAD ===";
        uptime;
        free -h;
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
            .on('data', d => process.stdout.write(d))
            .stderr.on('data', d => process.stderr.write(d));
    });
}).connect(config);
