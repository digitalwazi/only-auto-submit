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

    // We will use the full path to npx or tsx to be safe
    // Or just run "npm run worker" but ensure path is correct.

    const cmd = `
        echo "=== FIXING WORKER ===";
        cd /root/only-auto-submit;
        
        echo "=== INSTALLING DEPS (ENSURING TSX) ===";
        # Ensure tsx is present (it might be dev dependency, so install all)
        npm install; 
        
        echo "=== RESTARTING WORKER WITH ROBUST CMD ===";
        pm2 delete worker-daemon;
        # Start using npm run worker, which uses local node_modules
        pm2 start npm --name "worker-daemon" -- run worker;
        pm2 save;
        
        echo "=== CHECKING LOGS AGAIN ===";
        sleep 5;
        pm2 logs worker-daemon --lines 20 --nostream;
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
