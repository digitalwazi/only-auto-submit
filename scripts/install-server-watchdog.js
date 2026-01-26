const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 60000,
};

const conn = new Client();

const watchdogScript = `#!/bin/bash
# Watchdog for Auto-Submitter Worker
# Checks if the worker.log has been updated in the last 5 minutes

LOG_FILE="/root/only-auto-submit/logs/worker.log"
WATCHDOG_LOG="/root/watchdog.log"
PM2_PROCESS_NAME="worker-daemon"

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo "$(date): Log file not found at $LOG_FILE. Restarting worker..." >> $WATCHDOG_LOG
    pm2 restart $PM2_PROCESS_NAME
    exit 0
fi

# Check if file was modified in last 5 minutes
if [ $(find "$LOG_FILE" -mmin -5 | wc -l) -eq 0 ]; then
    echo "$(date): Worker log stale (>5 mins). Restarting worker..." >> $WATCHDOG_LOG
    
    # Kill any zombie chrome processes just in case
    pkill -f chrome || true
    
    pm2 restart $PM2_PROCESS_NAME
else
    echo "$(date): Worker OK" > /dev/null
fi
`;

conn.on('ready', () => {
    console.log('Client :: ready');

    const cmd = `
        echo "=== INSTALLING WATCHDOG SCRIPT ==="
        echo '${watchdogScript.replace(/'/g, "'\\''")}' > /root/watchdog.sh
        chmod +x /root/watchdog.sh
        
        echo "=== ADDING TO CRONTAB ==="
        # Remove existing watchdog entry to avoid duplicates
        crontab -l | grep -v "/root/watchdog.sh" > /tmp/cron_bkp
        # Add new entry (every 5 minutes)
        echo "*/5 * * * * /bin/bash /root/watchdog.sh" >> /tmp/cron_bkp
        # Install new crontab
        crontab /tmp/cron_bkp
        rm /tmp/cron_bkp
        
        echo "=== VERIFYING CRONTAB ==="
        crontab -l
        
        echo "=== DEPLOYMENT SUCCESS ==="
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
            if (code === 0) {
                console.log("Watchdog installed successfully.");
            } else {
                console.error("Watchdog installation failed.");
            }
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
