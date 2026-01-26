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
    const cmd = `sqlite3 /root/only-auto-submit/prisma/dev.db "SELECT fields FROM Campaign WHERE id='cmktwvqh10000hs9ymujj1n4r';"`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end());
        stream.on('data', (data) => process.stdout.write(data));
    });
}).connect(config);
