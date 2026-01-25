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
    // Install sqlite3 if missing
    const cmd = `
        apt-get install -y sqlite3 > /dev/null 2>&1;
        echo "=== DB FILE SIZE ===";
        ls -lh /root/auto-submitter/dev.db;
        
        echo "=== DB TABLE COUNTS ===";
        sqlite3 /root/auto-submitter/dev.db "SELECT count(*) FROM Campaign;" || echo "Query failed";
        
        echo "=== PRISMA ENV VAR ===";
        grep DATABASE_URL /root/auto-submitter/.env;
        
        echo "=== PM2 LOGS (OLD APP) ===";
        pm2 logs auto-submitter-old --lines 50 --nostream;
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
