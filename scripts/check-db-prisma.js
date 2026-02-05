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
    const run = (cmd) => new Promise((resolve) => {
        console.log(`\n>>> ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.error(err); return resolve(); }
            stream.on('data', d => process.stdout.write(d))
                .on('stderr', d => process.stderr.write(d))
                .on('close', resolve);
        });
    });

    // Use prisma to check database state via a node script
    console.log('\n=== DATABASE STATE VIA PRISMA ===');
    const checkScript = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const campaigns = await prisma.campaign.findMany();
    console.log("CAMPAIGNS:", JSON.stringify(campaigns, null, 2));
    
    const links = await prisma.link.findMany();
    console.log("LINKS:", JSON.stringify(links, null, 2));
    
    const settings = await prisma.globalSettings.findFirst();
    console.log("SETTINGS:", JSON.stringify(settings, null, 2));
    
    await prisma.$disconnect();
}
check().catch(console.error);
`;

    // Write script to server
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/check-db-script.js');
            stream.write(checkScript);
            stream.end();
            stream.on('close', () => { sftp.end(); resolve(); });
        });
    });

    // Run script
    await run('cd /root/auto-submitter && node check-db-script.js');

    conn.end();
}).connect(config);
