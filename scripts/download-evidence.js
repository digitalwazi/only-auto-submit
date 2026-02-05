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

        const remotePath = '/root/auto-submitter/public/screenshots/fail-cmkwrtgqk0001b564u94p7jsl-1769528915729.webp';
        const localPath = path.join(__dirname, 'failure_evidence.webp'); // Save to scripts dir temporarily

        console.log(`Downloading ${remotePath} to ${localPath}...`);

        sftp.fastGet(remotePath, localPath, (err) => {
            if (err) throw err;
            console.log('Download successful!');
            conn.end();
        });
    });
}).connect(config);
