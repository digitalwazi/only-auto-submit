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
        echo "=== RESTARTING PORT 3001 APP ===";
        # Restart by name if possible
        pm2 restart only-auto-submit-new || pm2 restart only-auto-submit;
        
        echo "=== WAITING FOR STARTUP ===";
        sleep 5;
        
        echo "=== PM2 STATUS ===";
        pm2 status;
        
        echo "=== CURL 3001 ===";
        curl -I http://localhost:3001;
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
