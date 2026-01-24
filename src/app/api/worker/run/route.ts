import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    // Check if there are running campaigns
    const runningCampaigns = await prisma.campaign.count({
        where: { status: "RUNNING" }
    });

    if (runningCampaigns === 0) {
        return NextResponse.json({
            status: "IDLE",
            message: "No running campaigns."
        });
    }

    // Check last log activity (ensure worker is alive)
    const lastLog = await prisma.systemLog.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    const isAlive = lastLog && (new Date().getTime() - lastLog.createdAt.getTime() < 120000); // 2 mins

    return NextResponse.json({
        status: isAlive ? "ACTIVE" : "STALLED",
        running_campaigns: runningCampaigns,
        last_log: lastLog?.createdAt
    });
}
