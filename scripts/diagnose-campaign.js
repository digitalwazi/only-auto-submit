const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 60000,
};

const campaignId = 'cmktwvqh10000hs9ymujj1n4r';

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    const cmd = `
        echo "=== LINKS STATUS for ${campaignId} ===";
        sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT status, COUNT(*) FROM Link WHERE campaignId='${campaignId}' GROUP BY status;";
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
