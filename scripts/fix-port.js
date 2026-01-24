const { Client } = require('ssh2');
const path = require('path');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 300000,
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const localPkg = path.join(__dirname, '../package.json');
        const remotePkg = '/root/auto-submitter/package.json';

        console.log('Uploading package.json...');
        sftp.fastPut(localPkg, remotePkg, (err) => {
            if (err) throw err;
            console.log('Upload complete.');

            conn.exec('pm2 restart next-app && pm2 status', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                    conn.end();
                }).on('data', (data) => {
                    process.stdout.write(data);
                });
            });
        });
    });
}).connect(config);
