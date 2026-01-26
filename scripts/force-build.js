const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 120000,
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    const cmd = `
        cd /root/auto-submitter;
        echo "=== CLEANING ===";
        rm -rf .next;
        echo "=== BUILDING ===";
        npm run build;
        echo "=== CHECKING BUILD_ID ===";
        if [ -f .next/BUILD_ID ]; then
            echo "BUILD_ID FOUND: $(cat .next/BUILD_ID)";
            echo "=== STARTING TEMP SERVER (5s) ===";
            timeout 5s npm start -- -p 3001 -H 0.0.0.0;
        else
            echo "CRITICAL: BUILD_ID MISSING AFTER BUILD";
            ls -la .next;
        fi
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
