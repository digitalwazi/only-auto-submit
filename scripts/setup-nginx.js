const { Client } = require('ssh2');

const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};

const nginxConfig = `
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

const ecosystem = `
module.exports = {
  apps : [{
    name   : "auto-submitter",
    script : "/usr/bin/npm",
    args   : "start",
    cwd    : "/root/auto-submitter",
    env: {
      NODE_ENV: "production"
    }
  }]
}
`;

const conn = new Client();

conn.on('ready', async () => {
    console.log('CONNECTED');
    const run = (cmd) => new Promise((resolve) => {
        console.log(`\n--- [RUNNING]: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // 1. Install Nginx
    await run('apt-get update && apt-get install -y nginx');

    // 2. Configure Nginx
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/etc/nginx/sites-available/default');
            stream.write(nginxConfig);
            stream.end();
            stream.on('close', () => {
                console.log('Nginx config written.');
                sftp.end();
                resolve();
            });
        });
    });

    // 3. Test and Reload Nginx
    await run('nginx -t');
    await run('systemctl restart nginx');
    await run('systemctl enable nginx');

    // 4. Revert package.json to port 3001
    await run(`sed -i 's/next start -p 80/next start -p 3001/g' /root/auto-submitter/package.json`);

    // 5. Update ecosystem to default (just npm start)
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/ecosystem.config.js');
            stream.write(ecosystem);
            stream.end();
            stream.on('close', () => {
                console.log('Ecosystem reset.');
                sftp.end();
                resolve();
            });
        });
    });

    // 6. Restart App on 3001
    const pm2 = '/usr/bin/pm2';
    await run(`${pm2} delete auto-submitter`);
    await run(`cd /root/auto-submitter && ${pm2} start ecosystem.config.js`);
    await run(`${pm2} save`);

    // 7. Verify
    await new Promise(r => setTimeout(r, 8000));
    console.log('\n--- VERIFICATION ---');
    await run('netstat -tulnp | grep :80');   // Should be nginx
    await run('netstat -tulnp | grep :3001'); // Should be node
    await run('curl -I http://localhost:80'); // Should return 200/301 from app

    conn.end();
}).connect(config);
