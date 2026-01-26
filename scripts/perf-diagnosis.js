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
        echo "=== SYSTEM RESOURCES ===";
        free -h;
        uptime;
        
        echo "=== DISK SPACE ===";
        df -h /;
        
        echo "=== PM2 LOGS (Last 50 lines - Look for crash/error) ===";
        pm2 logs worker-daemon --lines 50 --nostream;
        
        echo "=== ZOMBIE CHROME PROCESSES ===";
        pgrep -a chrome | wc -l;
        
        echo "=== RECENT OOM KILLS ===";
        grep -i "out of memory" /var/log/syslog | tail -n 5;
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
