"use server";

import prisma from "./prisma";
import { revalidatePath } from "next/cache";

// Log a message to the database (also prints to console)
export async function logToDB(message: string, type: "INFO" | "SUCCESS" | "ERROR" | "WARN" = "INFO") {
    console.log(`[${type}] ${message}`); // Keep console for debugging

    try {
        await prisma.systemLog.create({
            data: { message, type }
        });

        // Cleanup old logs (keep last 1000)
        // Note: Doing this every time might be heavy, maybe probability based? 
        // For now, let's just do it. SQLite checks are fast.
        const count = await prisma.systemLog.count();
        if (count > 1000) {
            const deleteCount = count - 1000;
            const toDelete = await prisma.systemLog.findMany({
                take: deleteCount,
                orderBy: { createdAt: 'asc' },
                select: { id: true }
            });
            await prisma.systemLog.deleteMany({
                where: { id: { in: toDelete.map(l => l.id) } }
            });
        }
    } catch (e) {
        console.error("Failed to write log to DB:", e);
    }
}

// Fetch logs for UI polling
export async function getRecentLogs() {
    return await prisma.systemLog.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' }
    });
}

// Force a restart by killing the process (PM2 will auto-restart)
export async function triggerRestart() {
    await logToDB("Manual restart triggered by user.", "WARN");
    // Wait a brief moment for log to save
    setTimeout(() => {
        process.exit(1);
    }, 500);
}
