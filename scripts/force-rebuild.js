const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 120000, // Long timeout for build
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    const cmd = `
        echo "=== 1. STOPPING ALL PROCESSES (FREE RAM) ===";
        pm2 stop all;
        
        echo "=== 1.5. PULLING LATEST CODE ===";
        cd /root/only-auto-submit;
        git pull;

        echo "=== 2. CLEANING PREVIOUS BUILD ===";
        cd /root/only-auto-submit;
        rm -rf .next;
        
        echo "=== 3. RUNNING CLEAN BUILD ===";
        # This is memory intensive
        export NODE_OPTIONS="--max-old-space-size=4096"; 
        npm run build;
        
        if [ $? -eq 0 ]; then
            echo "=== BUILD SUCCESSFUL ===";
            echo "=== 4. RESTARTING APP ===";
            pm2 restart next-app;
            pm2 restart worker-daemon;
            echo "=== 5. VERIFYING ===";
            sleep 5;
            pm2 logs next-app --lines 20 --nostream;
        else
            echo "=== BUILD FAILED ===";
            exit 1;
        fi
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
