const { Client } = require('ssh2');
const fs = require('fs');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const projectDir = '/root/auto-submitter';

conn.on('ready', () => {
    console.log('CONNECTED');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastGet(`${projectDir}/src/lib/worker.ts`, 'd:/only auto submit/src/lib/worker_server.ts', (err) => {
            if (err) throw err;
            console.log('DOWNLOADED');
            conn.end();
        });
    });
}).connect(config);
