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
        echo "=== PORT 3000 PROCESS ===";
        # Try to find PID using ss (since netstat might be missing)
        PID=$(ss -lptn 'sport = :3000' | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -n 1)
        
        if [ -z "$PID" ]; then
            echo "No process found on port 3000 (or permission denied/flag mismatch). Trying netstat..."
            PID=$(netstat -tulnp | grep :3000 | awk '{print $7}' | cut -d/ -f1)
        fi

        if [ -n "$PID" ]; then
            echo "PID: $PID"
            echo "=== PROCESS DETAILS ==="
            ps -fp $PID
            echo "=== WORKING DIRECTORY ==="
            pwdx $PID
            echo "=== PM2 CHECK ==="
            pm2 status | grep -B 2 -A 2 "$PID" || echo "Not managed by PM2 or ID mismatch"
        else 
            echo "Could not identify PID for port 3000."
            echo "=== PM2 STATUS ALL ==="
            pm2 status
        fi
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
