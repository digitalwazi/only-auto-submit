const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 15000
};

console.log('Connecting...');
const conn = new Client();

conn.on('ready', () => {
    console.log('CONNECTED');
    conn.exec('uptime; echo "---"; free -h', (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d))
            .on('close', () => conn.end());
    });
}).on('error', e => {
    console.error('ERROR:', e.message);
}).connect(config);
