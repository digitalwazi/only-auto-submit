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

    // Stop PM2
    conn.exec('/usr/bin/pm2 stop auto-submitter', () => { });

    console.log(`\n--- [RUNNING]: npm start (debug) ---`);
    conn.exec('cd /root/auto-submitter && npm start', (err, stream) => {
        if (err) { console.error(err); return conn.end(); }

        let output = '';
        stream.on('data', d => {
            process.stdout.write(d);
            output += d.toString();
        });
        stream.on('stderr', d => {
            process.stderr.write(d);
            output += d.toString();
        });

        // If it exits, we know it crashed
        stream.on('close', (code) => {
            console.log(`\n--- APP EXITED WITH CODE ${code} ---`);
            conn.end();
        });

        // Kill after 15 seconds if it hasn't crashed
        setTimeout(() => {
            console.log('\n--- TIMEOUT: Checking Netstat ---');
            conn.exec('netstat -tulnp | grep :3001', (e, s2) => {
                s2.on('data', d => process.stdout.write(d));
                s2.on('close', () => {
                    console.log('--- Killing process ---');
                    stream.signal('SIGINT');
                    conn.end();
                });
            });
        }, 15000);
    });
}).connect(config);
