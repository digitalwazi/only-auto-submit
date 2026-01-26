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
        echo "=== PULLING CHANGES ===";
        cd /root/only-auto-submit;
        git pull;
        
        echo "=== INSTALLING DEPS (JUST IN CASE) ===";
        npm install;
        
        echo "=== SYNCING DB SCHEMA ===";
        npx prisma db push;
        npx prisma generate;
        
        echo "=== RESTARTING WORKER ===";
        pm2 restart worker-daemon;
        
        echo "=== CHECKING LOGS FOR CLEANUP ===";
        sleep 5;
        pm2 logs worker-daemon --lines 20 --nostream;
        
        echo "=== ENSURING PM2 STARTUP ===";
        pm2 save;
        pm2 startup | grep "sudo env PATH"; # Check if startup logic is suggested
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
