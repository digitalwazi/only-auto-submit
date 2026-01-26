const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Wazi123@123123',
    readyTimeout: 60000,
};

const tasks = [
    {
        local: path.join(__dirname, 'worker.ts'),
        remote: '/root/only-auto-submit/scripts/worker.ts'
    },
    {
        local: path.join(__dirname, '../src/lib/worker.ts'),
        remote: '/root/only-auto-submit/src/lib/worker.ts'
    }
];

const conn = new Client();

async function uploadFile(conn, task) {
    return new Promise((resolve, reject) => {
        console.log(`Uploading ${task.local} to ${task.remote}...`);
        const content = fs.readFileSync(task.local);

        conn.exec(`cat > "${task.remote}"`, (err, stream) => {
            if (err) return reject(err);

            stream.on('close', (code, signal) => {
                if (code === 0) {
                    console.log(`Success: ${task.remote}`);
                    resolve();
                } else {
                    reject(new Error(`Exit code ${code}`));
                }
            });

            stream.write(content);
            stream.end();
        });
    });
}

conn.on('ready', async () => {
    console.log('Client :: ready');
    try {
        for (const task of tasks) {
            await uploadFile(conn, task);
        }

        console.log("=== RESTARTING WORKER ===");
        conn.exec('pm2 restart worker-daemon && pm2 saved', (err, stream) => {
            if (err) throw err;
            stream.on('close', () => {
                console.log("Restart command sent.");
                conn.end();
            });
            stream.stderr.on('data', d => process.stderr.write(d));
            stream.stdout.on('data', d => process.stdout.write(d));
        });

    } catch (e) {
        console.error("Upload failed:", e);
        conn.end();
    }
}).connect(config);
