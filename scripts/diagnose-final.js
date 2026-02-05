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
    const cmd = `
        cd /root/auto-submitter;
        echo "=== GIT STATUS ===";
        git log -1 --format="%h %s";
        
        echo "=== CHECKING BUILD ===";
        if [ -f .next/BUILD_ID ]; then
            echo "BUILD VALID. ID: $(cat .next/BUILD_ID)";
        else
            echo "BUILD MISSING!";
            ls -la .next;
        fi

        echo "=== PM2 STATUS ===";
        pm2 status next-app;

        echo "=== NETWORK BINDINGS (ss) ===";
        ss -tulpn | grep 3001;
        
        echo "=== FIREWALL (ufw) ===";
        ufw status | grep 3001;

        echo "=== CURL LOCAL ===";
        curl -I --connect-timeout 2 http://127.0.0.1:3001;
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
