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
        echo "=== RESETTING PM2 ===";
        pm2 delete all;
        
        echo "=== STARTING NEXT.JS APP (PORT 3001) ===";
        cd /root/only-auto-submit;
        # Ensure latest build is good (already built, but safe to verify)
        # Start 'start' script which maps to 'next start -p 3001'
        pm2 start npm --name "next-app" -- start;
        
        echo "=== STARTING WORKER DAEMON ===";
        # Start worker script
        pm2 start npx --name "worker-daemon" -- tsx scripts/worker.ts;
        
        echo "=== SAVING CONFIG ===";
        pm2 save;
        
        echo "=== CHECKING FIREWALL ===";
        ufw allow 3001;
        
        echo "=== VERIFYING PORTS ===";
        sleep 5;
        netstat -tulnp | grep 3001;
        
        echo "=== FINAL PM2 LIST ===";
        pm2 list;
        
        echo "=== DONE ===";
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
