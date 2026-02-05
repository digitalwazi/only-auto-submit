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
        echo "=== PORT HOLDERS ==="
        lsof -i :3001 || ss -lptn 'sport = :3001'
        
        echo "=== KILLING PORT HOLDERS ==="
        fuser -k 3001/tcp
        
        echo "=== WAITING ==="
        sleep 2
        
        echo "=== RESTARTING PM2 ==="
        pm2 restart next-app
        
        echo "=== STATUS CHECK ==="
        sleep 5
        pm2 list
        ss -tulnp | grep :3001
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
