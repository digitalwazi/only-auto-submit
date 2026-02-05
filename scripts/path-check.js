const { Client } = require('ssh2');
const config = {
    host: '31.97.188.144',
    port: 22,
    username: 'root',
    password: 'Eng123@123123'
};
const conn = new Client();
const envSetup = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"';

conn.on('ready', () => {
    conn.exec(`${envSetup} && which node && which npm`, (err, stream) => {
        stream.on('data', d => process.stdout.write(d)).on('close', () => conn.end());
    });
}).connect(config);
