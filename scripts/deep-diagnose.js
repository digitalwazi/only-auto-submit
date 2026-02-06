const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123',
    readyTimeout: 20000
};

const conn = new Client();

conn.on('ready', async () => {
    console.log('=== DEEP DIAGNOSTICS ===\n');
    const run = (cmd) => new Promise((resolve) => {
        console.log(`>>> ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            let output = '';
            stream.on('data', d => { output += d; process.stdout.write(d); })
                .on('stderr', d => process.stderr.write(d))
                .on('close', () => resolve(output));
        });
    });

    // 1. PM2 Process Status
    console.log('\n--- PM2 LIST ---');
    await run('pm2 list');

    // 2. PM2 Error Logs (last 50 lines)
    console.log('\n--- PM2 ERROR LOGS ---');
    await run('tail -50 /root/.pm2/logs/auto-submitter-error.log 2>/dev/null || echo "No error log"');

    // 3. PM2 Out Logs (last 30 lines)
    console.log('\n--- PM2 OUT LOGS ---');
    await run('tail -30 /root/.pm2/logs/auto-submitter-out.log 2>/dev/null || echo "No out log"');

    // 4. Check if port 3001 is listening
    console.log('\n--- PORT CHECK ---');
    await run('netstat -tlnp | grep 3001 || echo "PORT 3001 NOT LISTENING"');

    // 5. Check Nginx upstream config
    console.log('\n--- NGINX CONFIG ---');
    await run('cat /etc/nginx/sites-enabled/default | grep -A10 upstream || cat /etc/nginx/sites-enabled/default | head -30');

    // 6. Test localhost directly
    console.log('\n--- CURL LOCALHOST ---');
    await run('curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 || echo "CURL FAILED"');

    // 7. Memory and processes
    console.log('\n--- SYSTEM STATUS ---');
    await run('free -h');
    await run('ps aux | grep -E "(node|next)" | head -5');

    conn.end();
}).connect(config);
