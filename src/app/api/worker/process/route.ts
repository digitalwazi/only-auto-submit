import { NextResponse } from "next/server";
import { processBatch } from "@/lib/worker";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s for batch processing

export async function POST() {
    try {
        const result = await processBatch();
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({
            processed: 0,
            status: "ERROR",
            message: error.message
        }, { status: 500 });
    }
}
