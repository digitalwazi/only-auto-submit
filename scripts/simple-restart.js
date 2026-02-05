const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 30000,
    keepaliveInterval: 5000
};

const conn = new Client();

console.log('Connecting to server...');

conn.on('ready', async () => {
    console.log('CONNECTED');

    // Simple command with callback
    conn.exec('pkill -9 chrome; pkill -9 next; pm2 restart all; sleep 5; pm2 list; curl -I http://localhost:3001', (err, stream) => {
        if (err) {
            console.error('Error:', err);
            conn.end();
            return;
        }

        stream.on('data', d => process.stdout.write(d));
        stream.on('stderr', d => process.stderr.write(d));
        stream.on('close', () => {
            console.log('\nDone');
            conn.end();
        });
    });
});

conn.on('error', (err) => {
    console.error('Connection error:', err.message);
    process.exit(1);
});

conn.on('timeout', () => {
    console.error('Connection timeout');
    process.exit(1);
});

conn.connect(config);
