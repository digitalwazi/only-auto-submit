import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        // 1. Get Global Settings (to check if user turned it off)
        const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });

        // 2. Get Last Log (Heartbeat)
        const lastLog = await prisma.systemLog.findFirst({
            orderBy: { id: 'desc' },
            take: 1
        });

        if (!lastLog) {
            return NextResponse.json({
                status: "UNKNOWN",
                message: "No logs found yet.",
                lastSeen: null,
                isWorkerOn: settings?.isWorkerOn ?? true
            });
        }

        const now = new Date();
        const lastSeen = new Date(lastLog.createdAt);
        const diffSeconds = Math.round((now.getTime() - lastSeen.getTime()) / 1000);

        let status = "ACTIVE";

        // Thresholds
        if (diffSeconds > 120) status = "STALLED"; // 2 mins silence
        if (diffSeconds > 300) status = "OFFLINE"; // 5 mins silence
        if (!settings?.isWorkerOn) status = "PAUSED_BY_USER";

        return NextResponse.json({
            status,
            message: lastLog.message,
            lastSeen: lastSeen.toISOString(),
            agoSeconds: diffSeconds,
            isWorkerOn: settings?.isWorkerOn ?? true
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
