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
    conn.exec('pm2 jlist', (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', (code, signal) => {
            conn.end();
            try {
                const list = JSON.parse(output);
                list.forEach(p => {
                    console.log(`ID: ${p.pm_id} | Name: ${p.name} | Status: ${p.pm2_env.status} | Path: ${p.pm2_env.pm_cwd}`);
                });
            } catch (e) {
                console.log("Failed to parse JSON");
            }
        }).on('data', (data) => {
            output += data;
        });
    });
}).connect(config);
