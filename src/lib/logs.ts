"use server";

import prisma from "./prisma";
import { revalidatePath } from "next/cache";

// Log a message to the database (also prints to console)
export async function logToDB(message: string, type: "INFO" | "SUCCESS" | "ERROR" | "WARN" = "INFO") {
    console.log(`[${type}] ${message}`); // Always log to console

    try {
        await prisma.systemLog.create({
            data: { message, type }
        });

        // Cleanup: Only run 5% of the time to save DB resources (SQLite Locking prevention)
        if (Math.random() < 0.05) {
            const count = await prisma.systemLog.count();
            if (count > 2000) { // Increased buffer
                const deleteCount = count - 1000;
                // Optimized delete: Delete strictly older than N IDs
                // (Assuming auto-increment ID, lowest IDs are oldest)
                const first = await prisma.systemLog.findFirst({ orderBy: { id: 'asc' } });
                if (first) {
                    await prisma.systemLog.deleteMany({
                        where: { id: { lt: first.id + deleteCount } }
                    });
                }
            }
        }
    } catch (e) {
        // FAIL SAFE: Never crash the app just because logging failed
        console.error("Failed to write log to DB (Ignored to keep worker alive):", e);
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
