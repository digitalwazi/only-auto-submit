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
        echo "=== NAVIGATING TO CORRECT DIR ===";
        cd /root/only-auto-submit;
        
        echo "=== PULLING LATEST CODE ===";
        git pull;
        
        echo "=== VERIFYING FILE CONTENT ===";
        grep "Proof" src/app/campaigns/\\[id\\]/page.tsx || echo "CRITICAL: Proof code missing!";
        
        echo "=== REBUILDING NEXT.JS ===";
        npm run build;
        
        echo "=== RESTARTING PROCESSES ===";
        pm2 restart all;
        
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
