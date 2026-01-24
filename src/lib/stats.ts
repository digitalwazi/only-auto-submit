"use server";

import prisma from "./prisma";

export async function getCampaignProgress(campaignId: string) {
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                _count: {
                    select: { links: true }
                }
            }
        });

        if (!campaign) return null;

        const successCount = await prisma.link.count({
            where: {
                campaignId: campaignId,
                status: "SUCCESS"
            }
        });

        const failedCount = await prisma.link.count({
            where: {
                campaignId: campaignId,
                status: "FAILED"
            }
        });

        return {
            status: campaign.status,
            total: campaign._count.links,
            success: successCount,
            failed: failedCount,
            processed: successCount + failedCount
        };
    } catch (e) {
        console.error("Failed to get progress:", e);
        return null;
    }
}
