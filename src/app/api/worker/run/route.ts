import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processCampaign } from "@/lib/worker";

export async function GET() {
    const campaigns = await prisma.campaign.findMany({
        where: { status: "RUNNING" }
    });

    if (campaigns.length === 0) {
        return NextResponse.json({ message: "No running campaigns found." });
    }

    // Process one batch for each running campaign
    const results = [];
    for (const campaign of campaigns) {
        try {
            await processCampaign(campaign.id);
            results.push({ id: campaign.id, status: "SUCCESS" });
        } catch (e: any) {
            results.push({ id: campaign.id, status: "ERROR", error: e.message });
        }
    }

    return NextResponse.json({ processed: results });
}
