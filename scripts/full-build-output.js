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

    // Run build and capture ALL output
    console.log('\n>>> npm run build (full output)');
    conn.exec('cd /root/auto-submitter && npm run build 2>&1', (err, stream) => {
        if (err) { console.error(err); return conn.end(); }

        let output = '';
        stream.on('data', d => {
            const str = d.toString();
            process.stdout.write(d);
            output += str;
        });
        stream.on('close', (code) => {
            console.log(`\n\n=== BUILD EXITED WITH CODE ${code} ===`);
            conn.end();
        });
    });
}).connect(config);
