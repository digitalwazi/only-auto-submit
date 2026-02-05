const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED');

    // We just want to see if it starts.
    console.log(`\n--- [RUNNING]: npm start ---`);
    conn.exec('cd /root/auto-submitter && npm start', (err, stream) => {
        if (err) { console.error(err); return conn.end(); }

        let out = '';
        stream.on('data', d => {
            process.stdout.write(d);
            out += d.toString();
            // If we see "Ready on", it's good.
            if (out.includes('Ready in') || out.includes('started server') || out.includes('localhost:3001')) {
                console.log('SUCCESS: Server started manually.');
                conn.end();
            }
        }).on('stderr', d => process.stderr.write(d));

        // Kill it after 10 seconds if not successful yet
        setTimeout(() => {
            console.log('Timeout reached. Closing.');
            conn.end();
        }, 10000);
    });
}).connect(config);
