const { Client } = require('ssh2');
const path = require('path');

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
    conn.sftp((err, sftp) => {
        if (err) throw err;

        const localPath = path.join(__dirname, 'test-submission-live.js');
        const remotePath = '/root/auto-submitter/scripts/test-submission-live.js';

        console.log(`Uploading ${localPath} to ${remotePath}...`);

        sftp.fastPut(localPath, remotePath, (err) => {
            if (err) throw err;
            console.log('Upload successful!');
            conn.end();
        });
    });
}).connect(config);
