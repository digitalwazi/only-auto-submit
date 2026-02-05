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
    const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';
    const projectDir = '/root/auto-submitter';

    const cmd = `
        ${envSetup}
        cd ${projectDir}
        
        echo "=== INSTALLING DEPENDENCIES ==="
        npm install --legacy-peer-deps
        
        echo "=== GENERATING PRISMA ==="
        npx prisma generate
        
        echo "=== BUILDING NEXT.JS APP ==="
        npm run build
        
        echo "=== RESTARTING PM2 ==="
        pm2 restart next-app
        pm2 save
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
