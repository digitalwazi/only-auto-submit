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
        cd /root/auto-submitter;
        echo "=== STOPPING WORKER ===";
        pm2 stop worker-daemon;
        pm2 delete worker-daemon;
        
        echo "=== STARTING WORKER ===";
        # Ensure we use npx tsx and force reload
        pm2 start "npx tsx scripts/worker.ts" --name "worker-daemon" --cwd /root/auto-submitter --no-autorestart;
        
        echo "=== SAVING PM2 ===";
        pm2 save;

        echo "=== WAITING (10s) ===";
        sleep 10;

        echo "=== CHECKING LOGS (NEW) ===";
        pm2 logs worker-daemon --lines 20 --nostream;
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
