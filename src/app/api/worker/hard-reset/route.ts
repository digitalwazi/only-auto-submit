import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST(req: NextRequest) {
    try {
        console.log("[HARD RESET] Triggered via API");

        // 1. Toggle Master Switch (OFF -> ON)
        await prisma.globalSettings.update({
            where: { id: 1 },
            data: { isWorkerOn: false }
        });

        await new Promise(r => setTimeout(r, 1000));

        await prisma.globalSettings.update({
            where: { id: 1 },
            data: { isWorkerOn: true }
        });

        // 2. Kill Zombies & Restart Worker (Only works if running as privileged user/root or via PM2 in same context)
        // We use 'catch' to ignore errors (e.g., if pkill finds nothing)
        try {
            await execPromise('pkill -f chrome || true');
            await execPromise('pm2 restart worker-daemon');
        } catch (e) {
            console.error("[HARD RESET] Shell command failed:", e);
            // Continue - the DB toggle alone is often enough
        }

        return NextResponse.json({ success: true, message: "Hard Reset & Restart Triggered" });

    } catch (error: any) {
        console.error("[HARD RESET] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
