import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processCampaign } from "@/lib/worker";
import { logToDB } from "@/lib/logs";

export async function GET() {
    const campaigns = await prisma.campaign.findMany({
        where: { status: "RUNNING" }
    });

    if (campaigns.length === 0) {
        // Log occasionally to show life, or maybe just once per hour? 
        // For now, let's log it so user sees SOMETHING
        // await logToDB("Worker heartbeat: No running campaigns.", "INFO");
        return NextResponse.json({ message: "No running campaigns found." });
    }

    // Process one batch for each running campaign
    const results = [];
    for (const campaign of campaigns) {
        try {
            await logToDB(`Starting batch for campaign: ${campaign.name}`, "INFO");
            await processCampaign(campaign.id);
            results.push({ id: campaign.id, status: "SUCCESS" });
        } catch (e: any) {
            await logToDB(`Error processing campaign ${campaign.name}: ${e.message}`, "ERROR");
            results.push({ id: campaign.id, status: "ERROR", error: e.message });
        }
    }

    return NextResponse.json({ processed: results });
}
