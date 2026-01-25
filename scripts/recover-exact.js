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
        echo "=== LOCATING LARGE DB ===";
        # Find exactly the file > 1MB
        LARGE_DB=$(find /root -name "*.db" -type f -size +1M | head -n 1)
        echo "Found: $LARGE_DB"
        
        if [ -n "$LARGE_DB" ]; then
            echo "=== RESTORING TO AUTO-SUBMITTER ===";
            cp -v "$LARGE_DB" /root/auto-submitter/dev.db;
            # Also copy to prisma/dev.db if it exists, just in case
            [ -d /root/auto-submitter/prisma ] && cp -v "$LARGE_DB" /root/auto-submitter/prisma/dev.db;
            
            echo "=== VERIFYING RESTORED FILE ===";
            ls -lh /root/auto-submitter/dev.db;
            
            echo "=== RESTARTING OLD APP ===";
            pm2 restart auto-submitter-old;
        else
            echo "Error: Could not find large DB file."
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
