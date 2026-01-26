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
    // Get 5 failed links to see what kind of sites we are dealing with
    const query = "SELECT url, error FROM Link WHERE status='FAILED' LIMIT 5;";
    const cmd = `sqlite3 /root/only-auto-submit/prisma/dev.db "${query}"`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        });
    });
}).connect(config);
