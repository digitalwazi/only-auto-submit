
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.clear();
    console.log("\x1b[36m%s\x1b[0m", "=== Auto-Submitter Monitor ===");

    const campaigns = await prisma.campaign.findMany({
        include: {
            _count: {
                select: { links: true }
            }
        }
    });

    const settings = await prisma.globalSettings.findFirst();
    console.log(`\nSystem Status: ${settings?.isWorkerOn ? "\x1b[32mON\x1b[0m" : "\x1b[31mOFF\x1b[0m"}`);
    console.log(`Concurrency:   ${settings?.concurrency || 1}\n`);

    console.log("\x1b[33m%s\x1b[0m", "--- Campaign Queue Stats ---");

    for (const c of campaigns) {
        const pending = await prisma.link.count({ where: { campaignId: c.id, status: "PENDING" } });
        const processing = await prisma.link.count({ where: { campaignId: c.id, status: "PROCESSING" } });
        const success = await prisma.link.count({ where: { campaignId: c.id, status: "SUCCESS" } });
        const failed = await prisma.link.count({ where: { campaignId: c.id, status: "FAILED" } });

        console.log(`\nCampaign: ${c.name}`);
        console.log(`  Total:      ${c._count.links}`);
        console.log(`  Pending:    ${pending}`);
        console.log(`  Processing: \x1b[34m${processing}\x1b[0m`);
        console.log(`  Success:    \x1b[32m${success}\x1b[0m`);
        console.log(`  Failed:     \x1b[31m${failed}\x1b[0m`);
    }

    console.log("\x1b[33m%s\x1b[0m", "\n--- Recent Activity (Last 10) ---");
    const recent = await prisma.link.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        where: { status: { not: "PENDING" } }
    });

    recent.forEach(r => {
        let color = "\x1b[37m";
        if (r.status === "SUCCESS") color = "\x1b[32m";
        if (r.status === "FAILED") color = "\x1b[31m";
        if (r.status === "PROCESSING") color = "\x1b[34m";

        console.log(`${color}[${r.status}] \x1b[0m ${r.url.substring(0, 60)}...`);
    });

    console.log("\nRefresh by running command again.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
