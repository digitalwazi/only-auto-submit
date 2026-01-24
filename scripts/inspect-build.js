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
    const projectDir = '/root/auto-submitter';

    // Check .next recursive, and tail log
    const cmd = `
        cd ${projectDir};
        echo "=== .NEXT STRUCTURE ===";
        ls -R .next | grep ":$" | head -n 20; 
        echo "=== BUILD_ID LOCATION ===";
        find .next -name BUILD_ID;
        echo "=== BUILD LOG TAIL ===";
        tail -n 50 build.log;
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
