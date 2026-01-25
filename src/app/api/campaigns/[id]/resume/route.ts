import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } // Correct type for Next.js 15+
) {
    try {
        const { id } = await context.params;

        // 1. Reset any STUCK jobs (Processing -> Pending)
        const updatedLinks = await prisma.link.updateMany({
            where: {
                campaignId: id,
                status: "PROCESSING"
            },
            data: {
                status: "PENDING",
                error: "Manually Resumed"
            }
        });

        // 2. Ensure Campaign is RUNNING
        const campaign = await prisma.campaign.update({
            where: { id },
            data: { status: "RUNNING" }
        });

        return NextResponse.json({
            success: true,
            resumedCount: updatedLinks.count,
            message: `Resumed campaign and reset ${updatedLinks.count} stuck links.`
        });

    } catch (error) {
        console.error("Resume Error:", error);
        return NextResponse.json({ error: "Failed to resume campaign" }, { status: 500 });
    }
}
