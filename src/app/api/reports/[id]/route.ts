import { NextRequest, NextResponse } from "next/server";
import { generateCampaignReport } from "@/lib/reports";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } // Params is a Promise in newer Next.js
) {
    const { id } = await context.params;
    try {
        const buffer = await generateCampaignReport(id);
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="report-${id}.xlsx"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 404 });
    }
}
