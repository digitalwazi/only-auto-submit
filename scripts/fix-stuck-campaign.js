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

    // Fix script that resets stuck links and campaign
    const fixScript = `
const { PrismaClient } = require('@prisma/client');  
const prisma = new PrismaClient();

async function fix() {
    // Reset all PROCESSING links to PENDING
    const resetLinks = await prisma.link.updateMany({
        where: { status: 'PROCESSING' },
        data: { status: 'PENDING', error: null }
    });
    console.log("Reset PROCESSING links:", resetLinks.count);
    
    // Reset COMPLETED campaigns with pending links to RUNNING
    const campaigns = await prisma.campaign.findMany({ where: { status: 'COMPLETED' } });
    for (const campaign of campaigns) {
        const pendingLinks = await prisma.link.count({
            where: { campaignId: campaign.id, status: 'PENDING' }
        });
        if (pendingLinks > 0) {
            await prisma.campaign.update({
                where: { id: campaign.id },
                data: { status: 'RUNNING' }
            });
            console.log("Reactivated campaign:", campaign.name, "with", pendingLinks, "pending links");
        }
    }
    
    // Show final state
    const finalCampaigns = await prisma.campaign.findMany({ select: { id: true, name: true, status: true } });
    const finalLinks = await prisma.link.findMany({ select: { id: true, url: true, status: true } });
    console.log("\\nFINAL STATE:");
    console.log("Campaigns:", JSON.stringify(finalCampaigns));
    console.log("Links:", JSON.stringify(finalLinks));
    
    await prisma.$disconnect();
}
fix().catch(console.error);
`;

    // Write and run fix script
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const stream = sftp.createWriteStream('/root/auto-submitter/fix-stuck.js');
            stream.write(fixScript);
            stream.end();
            stream.on('close', () => { sftp.end(); resolve(); });
        });
    });

    console.log('\n=== FIXING STUCK DATA ===');
    await run('cd /root/auto-submitter && node fix-stuck.js');

    // Trigger worker
    console.log('\n=== TRIGGERING WORKER ===');
    await run('curl -s -X POST http://localhost:3001/api/worker/process');

    // Wait and check logs
    await new Promise(r => setTimeout(r, 10000));
    console.log('\n=== WORKER LOGS ===');
    await run('pm2 logs auto-submitter --lines 20 --nostream');

    conn.end();
}).connect(config);
