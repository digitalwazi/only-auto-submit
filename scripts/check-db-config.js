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
        echo "=== OLD APP ENV (3000) ===";
        grep "DATABASE_URL" /root/auto-submitter/.env || echo "No .env in auto-submitter";
        
        echo "=== NEW APP ENV (3001) ===";
        grep "DATABASE_URL" /root/only-auto-submit/.env || echo "No .env in only-auto-submit";
        
        echo "=== ALL DB FILES > 50KB ===";
        find /root -name "*.db" -type f -size +50k -exec ls -lh {} \\;;
        find /root -name "*.sqlite*" -type f -size +50k -exec ls -lh {} \\;;
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
